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

function emailLogoSrc() {
  return env.emailLogoUrl || joinUrl(env.clientAdminUrl, "/assets/Logo1.png");
}

function firstName(user) {
  return user.name?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "there";
}

function buildPasswordResetHtml({ user, resetUrl }) {
  const logoSrc = emailLogoSrc();

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F9FC;padding:8px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#FFFFFF;border-bottom:1px solid #E5E7EB;padding:8px 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="54" valign="middle" style="width:54px;vertical-align:middle;">
                      <img alt="BYBS" src="${escapeHtml(logoSrc)}" width="42" style="display:block;width:42px;height:auto;border:0;" />
                    </td>
                    <td valign="middle" style="color:#10233F;vertical-align:middle;padding-left:12px;">
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
                <h1 style="margin:0 0 8px;color:#10233F;font-size:22px;line-height:1.3;">Hi ${escapeHtml(firstName(user))}, reset your BYBS LMS password</h1>
                <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">We received a request to reset the password for your account. Use the secure link below within 30 minutes.</p>
                <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:700;">Reset password</a>
                <p style="margin:14px 0 0;color:#6B7280;font-size:12px;line-height:1.6;">If the button does not open, copy and paste this link into your browser:</p>
                <p style="margin:6px 0 0;color:#00337C;font-size:12px;line-height:1.6;word-break:break-all;">${escapeHtml(resetUrl)}</p>
                <p style="margin:14px 0 0;color:#6B7280;font-size:12px;line-height:1.6;">If you did not request this, you can safely ignore this email. Your current password will remain unchanged.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F9FF;border-top:1px solid #E5E7EB;padding:10px 16px;color:#6B7280;font-size:12px;line-height:1.5;">
                <strong style="color:#10233F;">BYBS LMS</strong><br />
                Build Your Best Self learning community.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail({ user, resetUrl }) {
  if (!emailConfigured()) {
    return { status: "notConfigured" };
  }

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your BYBS LMS password",
      html: buildPasswordResetHtml({ user, resetUrl })
    });
  } catch (error) {
    return {
      status: "failed",
      error: error.message || "Password reset email provider request failed"
    };
  }

  return { status: "sent" };
}
