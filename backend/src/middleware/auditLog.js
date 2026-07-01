import { SystemLog } from "../models/SystemLog.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken"
]);

function sanitize(value, depth = 0) {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }

  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item, depth + 1)])
  );
}

function shouldAudit(req) {
  if (!MUTATING_METHODS.has(req.method)) return false;
  if (!req.user || !["admin", "superAdmin"].includes(req.user.role)) return false;
  return req.originalUrl?.startsWith("/api/");
}

export function auditAdminAction(req, res, next) {
  res.on("finish", () => {
    if (!shouldAudit(req)) return;

    const metadata = {
      method: req.method,
      path: req.originalUrl,
      params: sanitize(req.params),
      query: sanitize(req.query),
      body: sanitize(req.body),
      targetId: req.params?.id,
      file: req.file
        ? sanitize({
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            compressed: Boolean(req.file.compressed),
            compressedSize: req.file.compressedSize
          })
        : undefined
    };

    SystemLog.create({
      user: req.user._id,
      action: `${req.method} ${req.path}`,
      statusCode: res.statusCode,
      route: req.originalUrl,
      metadata
    }).catch((error) => {
      console.error("Failed to write audit log", error);
    });
  });

  next();
}
