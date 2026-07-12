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

function firstName(application) {
  return application.name?.trim().split(/\s+/)[0] || application.email?.split("@")[0] || "there";
}

function portalLabel(applicantType) {
  return applicantType === "mentor" ? "mentor portal" : "student portal";
}

function portalUrl(applicantType) {
  return applicantType === "mentor" ? env.clientMentorUrl : env.clientStudentUrl;
}

function accessRows(access) {
  if (!access?.user) return "";

  const passwordRow = access.password
    ? `<tr>
        <td style="padding:8px;color:#6B7280;font-size:12px;text-transform:uppercase;">Temporary password</td>
        <td style="padding:8px;color:#10233F;font-weight:700;">${escapeHtml(access.password)}</td>
      </tr>`
    : `<tr>
        <td style="padding:8px;color:#6B7280;font-size:12px;text-transform:uppercase;">Password</td>
        <td style="padding:8px;color:#10233F;font-weight:700;">Use your existing BYBS LMS password.</td>
      </tr>`;

  return `<h2 style="margin:18px 0 8px;color:#10233F;font-size:16px;">Your beta access</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5E7EB;border-radius:8px;margin:10px 0 14px;">
      <tr>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Login link</td>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;"><a href="${escapeHtml(access.loginUrl)}" style="color:#00337C;font-weight:700;">${escapeHtml(access.loginUrl)}</a></td>
      </tr>
      <tr>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Email</td>
        <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#10233F;font-weight:700;">${escapeHtml(access.user.email)}</td>
      </tr>
      ${passwordRow}
    </table>
    <a href="${escapeHtml(access.loginUrl)}" style="display:inline-block;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:10px 14px;font-size:14px;font-weight:700;">Open your ${escapeHtml(portalLabel(access.user.role))}</a>`;
}

function buildAcceptanceHtml(application, access = null) {
  const logoSrc = emailLogoSrc();
  const websiteUrl = env.publicWebsiteUrl || "https://buildyourbestself.org";
  const testerType = application.applicantType === "mentor" ? "mentor beta tester" : "student beta tester";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">You have been accepted for BYBS LMS beta testing.</div>
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
                <h1 style="margin:0 0 8px;color:#10233F;font-size:24px;line-height:1.3;">Hi ${escapeHtml(firstName(application))}, you have been accepted</h1>
                <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">Thank you for applying to help test the BYBS LMS. We are happy to confirm that you have been accepted as a <strong>${escapeHtml(testerType)}</strong>.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5E7EB;border-radius:8px;margin:12px 0;">
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Testing window</td>
                    <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#10233F;font-weight:700;">July 3 to July 17, 2026</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Portal</td>
                    <td style="padding:8px;border-bottom:1px solid #E5E7EB;color:#10233F;font-weight:700;">${escapeHtml(portalLabel(application.applicantType))}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px;color:#6B7280;font-size:12px;text-transform:uppercase;">Email</td>
                    <td style="padding:8px;color:#10233F;font-weight:700;">${escapeHtml(application.email)}</td>
                  </tr>
                </table>
                ${accessRows(access)}
                <h2 style="margin:18px 0 8px;color:#10233F;font-size:16px;">What happens next</h2>
                <p style="margin:0 0 10px;color:#374151;font-size:14px;line-height:1.7;">Use the platform as naturally as possible and send feedback through the Beta Feedback section inside your portal.</p>
                <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.7;">You can also visit the main BYBS website to stay connected to the wider mission: <a href="${escapeHtml(websiteUrl)}" style="color:#00337C;font-weight:700;">${escapeHtml(websiteUrl)}</a>.</p>
                <p style="margin:16px 0 0;color:#6B7280;font-size:12px;line-height:1.6;">If you did not apply for BYBS LMS beta testing, you can ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F9FF;border-top:1px solid #E5E7EB;padding:10px 16px;color:#6B7280;font-size:12px;line-height:1.5;">
                <strong style="color:#10233F;">BYBS LMS</strong><br />
                Inspire, Heal, Evolve.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendBetaAcceptanceEmail(application, access = null) {
  if (!emailConfigured()) {
    return { status: "notConfigured" };
  }

  try {
    await sendEmail({
      to: application.email,
      subject: "You have been accepted for BYBS LMS beta testing",
      html: buildAcceptanceHtml(application, access)
    });
  } catch (error) {
    return {
      status: "failed",
      error: error.message || "Acceptance email provider request failed"
    };
  }

  return { status: "sent" };
}
