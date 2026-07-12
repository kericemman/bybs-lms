import { env } from "../config/env.js";
import { emailConfigured, sendEmail } from "./emailService.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function joinUrl(baseUrl, publicPath) {
  if (!baseUrl || !publicPath) return publicPath || "";
  return `${baseUrl.replace(/\/$/, "")}/${publicPath.replace(/^\//, "")}`;
}

function firstName(recipient) {
  return recipient.name?.trim().split(/\s+/)[0] || recipient.email?.split("@")[0] || "there";
}

function personalize(value = "", recipient) {
  return String(value)
    .replace(/{{\s*firstName\s*}}/gi, firstName(recipient))
    .replace(/{{\s*name\s*}}/gi, recipient.name || firstName(recipient))
    .replace(/{{\s*email\s*}}/gi, recipient.email || "");
}

export function personalizeAnnouncementForRecipient(announcement, recipient) {
  return {
    ...announcement,
    title: personalize(announcement.title, recipient),
    previewText: personalize(announcement.previewText || "", recipient),
    message: personalize(announcement.message || "", recipient),
    ctaLabel: personalize(announcement.ctaLabel || "", recipient)
  };
}

function emailLogoSrc() {
  return env.emailLogoUrl || joinUrl(env.clientAdminUrl, "/assets/Logo1.png");
}

function normalizeEmailImageSrc(source) {
  try {
    const url = new URL(source);
    if (url.pathname.startsWith("/uploads/") && env.publicApiUrl) {
      return joinUrl(env.publicApiUrl, url.pathname);
    }

    return source;
  } catch {
    if (source.startsWith("/uploads/") && env.publicApiUrl) {
      return joinUrl(env.publicApiUrl, source);
    }

    return source;
  }
}

function messageStartsWithGreeting(message = "") {
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return /^(hi|hello|dear)\b/i.test(firstLine || "");
}

function renderInline(text = "") {
  let output = escapeHtml(text);
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(
    /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" style="color:#00337C;font-weight:700;text-decoration:underline;">$1</a>'
  );
  return output;
}

function renderMessageHtml(message = "") {
  return message
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) return '<div style="height:12px;"></div>';

      const image = trimmed.match(/^!\[([^\]]*)]\(([^)\s]+)\)$/);
      if (image) {
        const imageSrc = normalizeEmailImageSrc(image[2]);
        if (!/^https?:\/\//i.test(imageSrc)) {
          return "";
        }

        return `<figure style="margin:18px 0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <img alt="${escapeHtml(image[1] || "Announcement image")}" src="${escapeHtml(imageSrc)}" style="display:block;width:100%;height:auto;border:0;" />
          ${image[1] ? `<figcaption style="padding:10px 12px;color:#6B7280;font-size:12px;">${escapeHtml(image[1])}</figcaption>` : ""}
        </figure>`;
      }

      if (trimmed === "---") {
        return '<hr style="border:0;border-top:1px solid #E5E7EB;margin:10px 0;" />';
      }

      if (trimmed.startsWith("## ")) {
        return `<h2 style="margin:18px 0 8px;color:#10233F;font-size:18px;line-height:1.35;">${renderInline(trimmed.slice(3))}</h2>`;
      }

      if (trimmed.startsWith("### ")) {
        return `<h3 style="margin:16px 0 8px;color:#00337C;font-size:15px;line-height:1.35;">${renderInline(trimmed.slice(4))}</h3>`;
      }

      if (trimmed.startsWith("> ")) {
        return `<blockquote style="margin:18px 0;border-left:4px solid #B76E79;background:#FFF0F0;padding:12px 14px;color:#374151;font-size:14px;line-height:1.65;">${renderInline(trimmed.slice(2))}</blockquote>`;
      }

      if (trimmed.startsWith("!! ")) {
        return `<p style="margin:16px 0;background:#FFD16655;border-radius:8px;padding:12px 14px;color:#10233F;font-size:14px;line-height:1.65;font-weight:700;">${renderInline(trimmed.slice(3))}</p>`;
      }

      if (trimmed.startsWith("- ")) {
        return `<p style="margin:8px 0;color:#374151;font-size:14px;line-height:1.65;"><span style="color:#B76E79;font-weight:700;">•</span> ${renderInline(trimmed.slice(2))}</p>`;
      }

      const numbered = trimmed.match(/^(\d+\.)\s(.+)/);
      if (numbered) {
        return `<p style="margin:8px 0;color:#374151;font-size:14px;line-height:1.65;"><span style="color:#00337C;font-weight:700;">${escapeHtml(numbered[1])}</span> ${renderInline(numbered[2])}</p>`;
      }

      return `<p style="margin:12px 0;color:#374151;font-size:14px;line-height:1.7;">${renderInline(trimmed)}</p>`;
    })
    .join("");
}

export function buildAnnouncementEmailHtml({
  title,
  previewText,
  message,
  type,
  ctaLabel,
  ctaUrl,
  recipientName
}) {
  const logoSrc = emailLogoSrc();
  const greetingHtml = messageStartsWithGreeting(message)
    ? ""
    : `<p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">Hi ${escapeHtml(recipientName || "there")},</p>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(previewText || title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F9FC;padding:8px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#FFFFFF;border-bottom:1px solid #E5E7EB;padding:8px 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="88" valign="middle" style="width:88px;vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:8px;">
                        <tr>
                          <td style="padding:6px;">
                            <img alt="BYBS" src="${escapeHtml(logoSrc)}" width="64" style="display:block;width:64px;height:auto;border:0;" />
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="color:#10233F;vertical-align:middle;padding-left:14px;">
                      <div style="font-size:15px;font-weight:700;">Build Your Best Self</div>
                      <div style="margin-top:4px;font-size:13px;color:#B76E79;font-weight:700;">Inspire, Heal, Evolve</div>
                      <div style="margin-top:4px;font-size:12px;color:#6B7280;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Learning Management System</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px;">
                <div style="color:#B76E79;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(type || "announcement")}</div>
                <h1 style="margin:10px 0 8px;color:#10233F;font-size:26px;line-height:1.25;">${escapeHtml(title)}</h1>
                ${previewText ? `<p style="margin:0 0 12px;color:#6B7280;font-size:14px;line-height:1.6;">${escapeHtml(previewText)}</p>` : ""}
                <div style="border-top:1px solid #E5E7EB;padding-top:12px;">
                  ${greetingHtml}
                  ${renderMessageHtml(message)}
                </div>
                ${
                  ctaLabel && ctaUrl
                    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;margin-top:16px;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:700;">${escapeHtml(ctaLabel)}</a>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="background:#F5F9FF;border-top:1px solid #E5E7EB;padding:10px 16px;color:#6B7280;font-size:12px;line-height:1.5;">
                <strong style="color:#10233F;">BYBS LMS</strong><br />
                You are receiving this because you are part of the Build Your Best Self learning community.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAnnouncementEmails({ recipients, announcement }) {
  if (!["email", "both"].includes(announcement.channel)) {
    return { status: "notRequested", sent: 0, failed: 0 };
  }

  if (!emailConfigured()) {
    return { status: "notConfigured", sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (const recipient of recipients) {
    try {
      const personalizedAnnouncement = personalizeAnnouncementForRecipient(announcement, recipient);
      const html = buildAnnouncementEmailHtml({
        ...personalizedAnnouncement,
        recipientName: firstName(recipient)
      });
      await sendEmail({
        to: recipient.email,
        subject: personalizedAnnouncement.title,
        html
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      lastError = error.message;
    }
  }

  return {
    status: failed > 0 ? "failed" : "sent",
    sent,
    failed,
    error: lastError
  };
}
