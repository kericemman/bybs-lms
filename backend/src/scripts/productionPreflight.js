import { env } from "../config/env.js";

const failures = [];

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

requireValue(env.isProduction, "NODE_ENV must be production.");
requireValue(/^mongodb(?:\+srv)?:\/\//.test(env.mongodbUri), "MONGODB_URI must use MongoDB, not the embedded development database.");
requireValue(env.jwtSecret.length >= 32, "JWT_SECRET must contain at least 32 characters.");
requireValue(isHttpsUrl(env.clientAdminUrl), "CLIENT_ADMIN_URL must be an HTTPS URL.");
requireValue(isHttpsUrl(env.clientMentorUrl), "CLIENT_MENTOR_URL must be an HTTPS URL.");
requireValue(isHttpsUrl(env.clientStudentUrl), "CLIENT_STUDENT_URL must be an HTTPS URL.");
requireValue(isHttpsUrl(env.publicApiUrl), "PUBLIC_API_URL must be an HTTPS URL.");
requireValue(isHttpsUrl(env.certificateVerifyBaseUrl), "CERTIFICATE_VERIFY_BASE_URL must be an HTTPS URL.");
requireValue(isHttpsUrl(env.emailLogoUrl), "EMAIL_LOGO_URL must be a publicly reachable HTTPS URL.");
requireValue(Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret), "Cloudinary credentials must be complete.");
requireValue(env.requireCompressedUploads, "REQUIRE_COMPRESSED_UPLOADS must remain enabled in production.");
requireValue(!env.seedSuperAdminOnStart, "SEED_SUPER_ADMIN_ON_START must be false after initial setup.");

const emailConfigured = Boolean(
  env.resendApiKey
  || (env.smtpHost && env.smtpUser && env.smtpPass)
);
requireValue(emailConfigured, "Configure Resend or complete SMTP credentials before deployment.");
requireValue(!env.emailFrom.includes("@bybs.local"), "EMAIL_FROM must use the verified production sender.");
requireValue(!env.adminAlertsEnabled || env.adminAlertEmails.length > 0, "ADMIN_ALERT_EMAILS is required when admin alerts are enabled.");

if (failures.length) {
  console.error("BYBS LMS production preflight failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("BYBS LMS production preflight passed.");
console.log(`Assignment deadline reminders: ${env.assignmentReminderJobEnabled ? "enabled" : "disabled"}`);
