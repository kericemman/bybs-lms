import crypto from "node:crypto";
import { env } from "../config/env.js";

const QR_VERSION = 5;
const QR_SIZE = QR_VERSION * 4 + 17;
const QR_DATA_CODEWORDS = 108;
const QR_ECC_CODEWORDS = 26;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firstName(user) {
  return (user?.name || "").trim().split(/\s+/)[0] || "there";
}

export function createCertificateNumber() {
  const year = new Date().getFullYear();
  return `BYBS-${year}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export function createVerificationCode() {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

export function certificateVerificationUrl(code) {
  const baseUrl = (env.certificateVerifyBaseUrl || env.clientStudentUrl).replace(/\/$/, "");
  return `${baseUrl}/verify-certificate/${encodeURIComponent(code)}`;
}

function textBytes(value) {
  return Array.from(Buffer.from(String(value), "utf8"));
}

function appendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function buildDataCodewords(value) {
  const bytes = textBytes(value);
  const bits = [];
  const capacityBits = QR_DATA_CODEWORDS * 8;

  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  if (bits.length > capacityBits) {
    throw new Error("Certificate verification URL is too long for QR encoding");
  }

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }

  for (let pad = 0; data.length < QR_DATA_CODEWORDS; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  return data;
}

const expTable = new Array(512);
const logTable = new Array(256);
let fieldValue = 1;
for (let index = 0; index < 255; index += 1) {
  expTable[index] = fieldValue;
  logTable[fieldValue] = index;
  fieldValue <<= 1;
  if (fieldValue & 0x100) fieldValue ^= 0x11d;
}
for (let index = 255; index < expTable.length; index += 1) {
  expTable[index] = expTable[index - 255];
}

function gfMultiply(left, right) {
  return left && right ? expTable[logTable[left] + logTable[right]] : 0;
}

function reedSolomonDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let index = 0; index < degree; index += 1) {
    for (let item = 0; item < degree; item += 1) {
      result[item] = gfMultiply(result[item], root);
      if (item + 1 < degree) result[item] ^= result[item + 1];
    }
    root = gfMultiply(root, 0x02);
  }

  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return result;
}

function formatBits(mask) {
  const errorCorrectionBits = 1;
  const data = (errorCorrectionBits << 3) | mask;
  let remainder = data;

  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) ? 0x537 : 0);
  }

  return ((data << 10) | remainder) ^ 0x5412;
}

function bit(value, index) {
  return ((value >>> index) & 1) !== 0;
}

function createMatrix() {
  const modules = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));
  const reserved = Array.from({ length: QR_SIZE }, () => new Array(QR_SIZE).fill(false));

  function setFunction(x, y, dark) {
    if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  }

  function drawFinder(centerX, centerY) {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
      }
    }
  }

  function drawAlignment(centerX, centerY) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  function drawFormat(mask) {
    const bits = formatBits(mask);
    for (let index = 0; index <= 5; index += 1) setFunction(8, index, bit(bits, index));
    setFunction(8, 7, bit(bits, 6));
    setFunction(8, 8, bit(bits, 7));
    setFunction(7, 8, bit(bits, 8));
    for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, bit(bits, index));
    for (let index = 0; index < 8; index += 1) setFunction(QR_SIZE - 1 - index, 8, bit(bits, index));
    for (let index = 8; index < 15; index += 1) setFunction(8, QR_SIZE - 15 + index, bit(bits, index));
    setFunction(8, QR_SIZE - 8, true);
  }

  drawFinder(3, 3);
  drawFinder(QR_SIZE - 4, 3);
  drawFinder(3, QR_SIZE - 4);
  drawAlignment(30, 30);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const dark = index % 2 === 0;
    setFunction(index, 6, dark);
    setFunction(6, index, dark);
  }

  drawFormat(0);

  return { modules, reserved, drawFormat };
}

function mask0(x, y) {
  return (x + y) % 2 === 0;
}

export function qrCodeSvg(value, { border = 4, dark = "#10233F", light = "#FFFFFF" } = {}) {
  const data = buildDataCodewords(value);
  const errorCorrection = reedSolomonRemainder(data, reedSolomonDivisor(QR_ECC_CODEWORDS));
  const codewords = [...data, ...errorCorrection];
  const { modules, reserved, drawFormat } = createMatrix();
  let bitIndex = 0;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = ((right + 1) & 2) === 0 ? QR_SIZE - 1 - vertical : vertical;

      for (let columnOffset = 0; columnOffset < 2; columnOffset += 1) {
        const x = right - columnOffset;
        if (reserved[y][x]) continue;

        let darkModule = false;
        if (bitIndex < codewords.length * 8) {
          darkModule = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
        }
        modules[y][x] = mask0(x, y) ? !darkModule : darkModule;
      }
    }
  }

  drawFormat(0);

  const size = QR_SIZE + border * 2;
  const path = [];
  modules.forEach((row, y) => {
    row.forEach((isDark, x) => {
      if (isDark) path.push(`M${x + border},${y + border}h1v1h-1z`);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="164" height="164" role="img" aria-label="Certificate verification QR code" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${light}"/><path fill="${dark}" d="${path.join(" ")}"/></svg>`;
}

function certificateDate(value) {
  if (!value) return "Not issued";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function certificatePublicData(certificate) {
  return {
    certificateNumber: certificate.certificateNumber,
    studentName: certificate.student?.name,
    cohortTitle: certificate.cohort?.title,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    valid: certificate.status === "issued"
  };
}

export function certificateHtml(certificate) {
  const verifyUrl = certificateVerificationUrl(certificate.verificationCode);
  const qrSvg = qrCodeSvg(verifyUrl);
  const studentName = certificate.student?.name || "BYBS Graduate";
  const cohortTitle = certificate.cohort?.title || "Build Your Best Self Program";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(certificate.certificateNumber)} - BYBS Certificate</title>
    <style>
      body{margin:0;background:#F7F9FC;color:#10233F;font-family:Inter,Arial,sans-serif;}
      .page{min-height:100vh;display:grid;place-items:center;padding:28px;}
      .certificate{width:min(980px,100%);background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:46px;box-shadow:0 20px 60px rgba(16,35,63,.12);}
      .eyebrow{color:#B76E79;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:12px;}
      h1{margin:18px 0 8px;color:#00337C;font-size:42px;line-height:1.08;}
      .name{margin:30px 0 12px;color:#10233F;font-size:34px;font-weight:800;}
      .copy{color:#374151;font-size:16px;line-height:1.7;max-width:680px;}
      .meta{margin-top:34px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;}
      .rows{display:grid;gap:10px;color:#374151;font-size:14px;}
      .label{color:#6B7280;font-size:12px;text-transform:uppercase;font-weight:700;letter-spacing:.06em;}
      .qr{border:1px solid #E5E7EB;border-radius:10px;padding:12px;text-align:center;}
      .qr p{margin:8px 0 0;color:#6B7280;font-size:11px;max-width:180px;}
      .signature{margin-top:36px;border-top:1px solid #E5E7EB;padding-top:18px;color:#374151;font-size:13px;}
      @media print{body{background:#fff}.page{padding:0}.certificate{box-shadow:none;border-radius:0}}
      @media (max-width:720px){.certificate{padding:28px}.meta{grid-template-columns:1fr}h1{font-size:32px}.name{font-size:26px}}
    </style>
  </head>
  <body>
    <main class="page">
      <section class="certificate">
        <div class="eyebrow">Build Your Best Self</div>
        <h1>Certificate of Completion</h1>
        <p class="copy">This certificate is proudly awarded to</p>
        <div class="name">${escapeHtml(studentName)}</div>
        <p class="copy">for completing the ${escapeHtml(cohortTitle)} and demonstrating commitment to the BYBS journey of growth, healing, discipline, and purpose.</p>
        <div class="meta">
          <div class="rows">
            <div><div class="label">Certificate number</div>${escapeHtml(certificate.certificateNumber)}</div>
            <div><div class="label">Issued date</div>${escapeHtml(certificateDate(certificate.issuedAt))}</div>
            <div><div class="label">Verification</div><a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></div>
          </div>
          <div class="qr">${qrSvg}<p>Scan to verify authenticity.</p></div>
        </div>
        <div class="signature">Issued by Build Your Best Self LMS. Verification status: ${escapeHtml(certificate.status)}.</div>
      </section>
    </main>
  </body>
</html>`;
}

export function serializeCertificate(certificate, { includeHtml = false } = {}) {
  const verificationUrl = certificate.verificationCode ? certificateVerificationUrl(certificate.verificationCode) : "";
  const data = {
    _id: certificate._id,
    student: certificate.student,
    cohort: certificate.cohort,
    mentorApprovedBy: certificate.mentorApprovedBy,
    mentorApprovedAt: certificate.mentorApprovedAt,
    mentorNotes: certificate.mentorNotes,
    status: certificate.status,
    certificateNumber: certificate.certificateNumber,
    verificationCode: certificate.verificationCode,
    verificationUrl,
    issuedBy: certificate.issuedBy,
    issuedAt: certificate.issuedAt,
    progressSnapshot: certificate.progressSnapshot,
    currentProgress: certificate.currentProgress,
    revokedBy: certificate.revokedBy,
    revokedAt: certificate.revokedAt,
    revokeReason: certificate.revokeReason,
    createdAt: certificate.createdAt,
    updatedAt: certificate.updatedAt
  };

  if (includeHtml && certificate.status === "issued" && certificate.verificationCode) {
    data.certificateHtml = certificateHtml(certificate);
    data.qrCodeSvg = qrCodeSvg(verificationUrl);
  }

  data.greeting = `Congratulations, ${firstName(certificate.student)}.`;
  return data;
}
