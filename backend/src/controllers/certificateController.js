import { Certificate } from "../models/Certificate.js";
import { User } from "../models/User.js";
import {
  certificatePublicData,
  createCertificateNumber,
  createVerificationCode,
  serializeCertificate
} from "../services/certificateService.js";
import { notifyUser } from "../services/portalNotificationService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText } from "../utils/sanitizeRichText.js";

function certificatePopulate(query) {
  return query
    .populate("student", "name email phone status cohort profileImage")
    .populate("cohort", "title status")
    .populate("mentorApprovedBy", "name email")
    .populate("issuedBy", "name email role")
    .populate("revokedBy", "name email role");
}

async function populateCertificate(certificate) {
  await certificate.populate("student", "name email phone status cohort profileImage");
  await certificate.populate("cohort", "title status");
  await certificate.populate("mentorApprovedBy", "name email");
  await certificate.populate("issuedBy", "name email role");
  await certificate.populate("revokedBy", "name email role");
  return certificate;
}

function certificateSearchFilter(search = "") {
  const cleanSearch = sanitizePlainText(search).trim();
  if (!cleanSearch) return {};

  return {
    $or: [
      { certificateNumber: { $regex: cleanSearch, $options: "i" } },
      { verificationCode: { $regex: cleanSearch, $options: "i" } }
    ]
  };
}

async function uniqueCertificateIdentity() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const certificateNumber = createCertificateNumber();
    const verificationCode = createVerificationCode();
    const existing = await Certificate.exists({
      $or: [{ certificateNumber }, { verificationCode }]
    });

    if (!existing) {
      return { certificateNumber, verificationCode };
    }
  }

  throw new ApiError(500, "Could not generate a unique certificate number");
}

export const listAdminCertificates = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    ...certificateSearchFilter(req.query.search)
  };

  if (req.query.status) filter.status = req.query.status;
  if (req.query.cohort) filter.cohort = req.query.cohort;
  if (req.query.student) filter.student = req.query.student;

  const [certificates, total] = await Promise.all([
    certificatePopulate(Certificate.find(filter))
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Certificate.countDocuments(filter)
  ]);

  res.json(paginatedResponse({
    data: certificates.map((certificate) => serializeCertificate(certificate)),
    total,
    page,
    limit
  }));
});

export const issueCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);

  if (!certificate) {
    throw new ApiError(404, "Certificate request not found");
  }

  if (certificate.status === "revoked") {
    throw new ApiError(409, "Revoked certificates cannot be issued");
  }

  if (!certificate.certificateNumber || !certificate.verificationCode) {
    Object.assign(certificate, await uniqueCertificateIdentity());
  }

  certificate.status = "issued";
  certificate.issuedBy = req.user._id;
  certificate.issuedAt = certificate.issuedAt || new Date();
  certificate.revokedBy = undefined;
  certificate.revokedAt = undefined;
  certificate.revokeReason = undefined;
  await certificate.save();

  await User.updateOne(
    { _id: certificate.student, role: "student", status: { $ne: "removed" } },
    { status: "completed" }
  );

  await populateCertificate(certificate);

  await notifyUser({
    recipient: certificate.student,
    portalRole: "student",
    notification: {
      title: "Your BYBS certificate is ready",
      message: "Congratulations. Your BYBS certificate has been issued and is ready to download from your mentee portal.",
      channel: "both",
      previewText: "Your BYBS certificate is ready to download.",
      ctaLabel: "Open certificate",
      ctaUrl: "/app/certificates",
      targetType: "certificate",
      targetRole: "student",
      targetLabel: certificate.certificateNumber,
      type: "system",
      readStatus: false
    }
  });

  res.json({ data: serializeCertificate(certificate, { includeHtml: true }) });
});

export const revokeCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);

  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  certificate.status = "revoked";
  certificate.revokedBy = req.user._id;
  certificate.revokedAt = new Date();
  certificate.revokeReason = sanitizePlainText(req.body.revokeReason || "Revoked by admin");
  await certificate.save();
  await populateCertificate(certificate);

  res.json({ data: serializeCertificate(certificate) });
});

export const listStudentCertificates = asyncHandler(async (req, res) => {
  const certificates = await certificatePopulate(
    Certificate.find({
      student: req.user._id,
      status: "issued"
    }).sort({ issuedAt: -1, updatedAt: -1 })
  );

  res.json({
    data: certificates.map((certificate) => serializeCertificate(certificate, { includeHtml: true }))
  });
});

export const verifyCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificatePopulate(
    Certificate.findOne({ verificationCode: req.params.code.toUpperCase() })
  );

  if (!certificate) {
    throw new ApiError(404, "Certificate not found");
  }

  res.json({ data: certificatePublicData(certificate) });
});
