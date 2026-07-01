import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendEnvPath = resolve(currentDir, "../../.env");

dotenv.config({ path: backendEnvPath });

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const jwtSecret = process.env.JWT_SECRET || "";
const configuredMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "";

if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters in production.");
}

if (isProduction && !configuredMongoUri) {
  throw new Error("MONGODB_URI must be set in production.");
}

export const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 5050),
  mongodbUri: configuredMongoUri || "memory",
  mongoMaxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
  mongoMinPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
  mongoServerSelectionTimeoutMs: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000),
  mongoSocketTimeoutMs: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
  jwtSecret: jwtSecret || "development-only-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "2mb",
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 30 * 1000),
  keepAliveTimeoutMs: Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 65 * 1000),
  headersTimeoutMs: Number(process.env.HEADERS_TIMEOUT_MS || 66 * 1000),
  globalRateLimitWindowMs: Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  globalRateLimitMax: Number(process.env.GLOBAL_RATE_LIMIT_MAX || 1500),
  mutationRateLimitWindowMs: Number(process.env.MUTATION_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  mutationRateLimitMax: Number(process.env.MUTATION_RATE_LIMIT_MAX || 180),
  clientAdminUrl: process.env.CLIENT_ADMIN_URL || "http://localhost:5173",
  clientMentorUrl: process.env.CLIENT_MENTOR_URL || "http://localhost:5174",
  clientStudentUrl: process.env.CLIENT_STUDENT_URL || "http://localhost:5175",
  publicApiUrl: process.env.PUBLIC_API_URL || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET_KEY || "",
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || "bybs-lms/uploads",
  requireCompressedUploads: process.env.REQUIRE_COMPRESSED_UPLOADS !== "false",
  emailLogoUrl: process.env.EMAIL_LOGO_URL || "",
  publicWebsiteUrl: process.env.PUBLIC_WEBSITE_URL || "",
  mentorWhatsappUrl: process.env.MENTOR_WHATSAPP_URL || "",
  mentorChannelUrl: process.env.MENTOR_CHANNEL_URL || "",
  socialFacebookUrl: process.env.SOCIAL_FACEBOOK_URL || "",
  socialInstagramUrl: process.env.SOCIAL_INSTAGRAM_URL || "",
  socialLinkedInUrl: process.env.SOCIAL_LINKEDIN_URL || "",
  socialYoutubeUrl: process.env.SOCIAL_YOUTUBE_URL || "",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  adminAlertsEnabled: process.env.ADMIN_ALERTS_ENABLED !== "false",
  adminAlertEmails: (process.env.ADMIN_ALERT_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean),
  adminAlertCooldownMs: Number(process.env.ADMIN_ALERT_COOLDOWN_MS || 10 * 60 * 1000),
  slowRequestThresholdMs: Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 3000),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "BYBS LMS <alerts@bybs.local>",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10),
  mongoMemoryDownloadDir: process.env.MONGO_MEMORY_DOWNLOAD_DIR || "/private/tmp/bybs-mongodb-binaries",
  mongoMemoryDbPath: process.env.MONGO_MEMORY_DB_PATH || "/private/tmp/bybs-lms-mongodb",
  mongoMemoryPort: Number(process.env.MONGO_MEMORY_PORT || 27018),
  seedSuperAdminOnStart: process.env.SEED_SUPER_ADMIN_ON_START === "true",
  superAdminName: process.env.SUPER_ADMIN_NAME || "BYBS Super Admin",
  superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "admin@bybs.local",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || ""
};
