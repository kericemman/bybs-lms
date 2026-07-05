import { env } from "../config/env.js";
import { Notification } from "../models/Notification.js";
import { SystemLog } from "../models/SystemLog.js";
import { User } from "../models/User.js";
import { emailConfigured, sendEmail } from "./emailService.js";

const alertCooldowns = new Map();

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shouldSendAlert(key) {
  const now = Date.now();
  const previous = alertCooldowns.get(key);

  if (previous && now - previous < env.adminAlertCooldownMs) {
    return false;
  }

  alertCooldowns.set(key, now);
  return true;
}

function joinUrl(baseUrl, publicPath) {
  if (!baseUrl || !publicPath) return publicPath || "";
  return `${baseUrl.replace(/\/$/, "")}/${publicPath.replace(/^\//, "")}`;
}

function emailLogoSrc() {
  return env.emailLogoUrl || joinUrl(env.clientAdminUrl, "/assets/Logo1.png");
}

function buildAlertHtml(alert) {
  const dashboardUrl = `${env.clientAdminUrl.replace(/\/$/, "")}/system-logs`;
  const logoUrl = emailLogoSrc();

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F9FC;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#FFFFFF;border-bottom:1px solid #E5E7EB;padding:24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:64px;">
                      <img alt="BYBS" src="${escapeHtml(logoUrl)}" width="56" height="56" style="display:block;border-radius:8px;background:#FFFFFF;object-fit:contain;padding:4px;" />
                    </td>
                    <td style="color:#10233F;padding-left:12px;">
                      <div style="font-size:15px;font-weight:700;">Build Your Best Self</div>
                      <div style="margin-top:4px;font-size:13px;color:#B76E79;font-weight:700;">Inspire, Heal, Evolve</div>
                      <div style="margin-top:4px;font-size:12px;color:#6B7280;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Learning Management System</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;color:#10233F;font-size:22px;line-height:1.3;">${escapeHtml(alert.title)}</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(alert.message)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5E7EB;border-radius:8px;margin-top:16px;">
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Route</td>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#10233F;font-size:14px;font-weight:700;">${escapeHtml(alert.method)} ${escapeHtml(alert.route)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Status</td>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#10233F;font-size:14px;font-weight:700;">${escapeHtml(alert.statusCode || "n/a")}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;color:#6B7280;font-size:12px;text-transform:uppercase;">Duration</td>
                    <td style="padding:12px;color:#10233F;font-size:14px;font-weight:700;">${escapeHtml(alert.durationMs ? `${alert.durationMs}ms` : "n/a")}</td>
                  </tr>
                </table>
                <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;margin-top:20px;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:11px 16px;font-size:14px;font-weight:700;">Open system logs</a>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F9FF;border-top:1px solid #E5E7EB;padding:16px 24px;color:#6B7280;font-size:12px;line-height:1.5;">
                This alert was generated automatically by BYBS LMS monitoring.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendAlertEmail(recipients, alert) {
  if (!emailConfigured() || !recipients.length) return;

  await sendEmail({
    to: recipients,
    subject: `[BYBS LMS] ${alert.title}`,
    html: buildAlertHtml(alert)
  });
}

export async function notifyAdminIncident(alert) {
  if (!env.adminAlertsEnabled) return;

  const route = alert.route || "unknown route";
  const dedupeKey = `${alert.kind || "incident"}:${alert.method || ""}:${route}:${alert.statusCode || ""}`;

  if (!shouldSendAlert(dedupeKey)) return;

  const admins = await User.find({
    role: { $in: ["admin", "superAdmin"] },
    status: "active"
  }).select("email name role");

  const emailRecipients = env.adminAlertEmails.length
    ? env.adminAlertEmails
    : admins.map((admin) => admin.email).filter(Boolean);

  const metadata = {
    kind: alert.kind,
    method: alert.method,
    route,
    statusCode: alert.statusCode,
    durationMs: alert.durationMs,
    emailConfigured: emailConfigured(),
    emailRecipients: emailRecipients.length
  };

  await SystemLog.create({
    action: alert.kind === "slowRequest" ? "ADMIN_SLOW_REQUEST_ALERT" : "ADMIN_ERROR_ALERT",
    errorMessage: alert.errorMessage,
    statusCode: alert.statusCode,
    route,
    metadata
  });

  if (admins.length) {
    await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        title: alert.title,
        message: alert.message,
        channel: "both",
        previewText: alert.message.slice(0, 160),
        type: "system",
        readStatus: false
      }))
    );
  }

  try {
    await sendAlertEmail(emailRecipients, alert);
  } catch (error) {
    await SystemLog.create({
      action: "ADMIN_ALERT_EMAIL_FAILED",
      errorMessage: error.message,
      statusCode: 500,
      route,
      metadata
    });
  }
}
