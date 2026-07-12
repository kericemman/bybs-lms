import { env } from "../config/env.js";
import { notifyAdminIncident } from "../services/adminAlertService.js";

function cleanRoute(req) {
  return req.originalUrl?.split("?")[0] || req.path || req.url || "unknown route";
}

export function errorHandler(error, req, res, _next) {
  const isMulterFileSizeError = error.code === "LIMIT_FILE_SIZE";
  const isMulterFileError = typeof error.code === "string" && error.code.startsWith("LIMIT_");
  const statusCode = error.statusCode || (isMulterFileError ? 400 : 500);
  const isServerError = statusCode >= 500;
  const message = isMulterFileSizeError
    ? "The uploaded file is too large. Please upload a file within the allowed size limit."
    : error.message || "Something went wrong";

  if (isServerError) {
    console.error(error);
    notifyAdminIncident({
      kind: "serverError",
      title: "Website error detected",
      message: error.message || "A server error occurred in BYBS LMS.",
      method: req.method,
      route: cleanRoute(req),
      statusCode,
      errorMessage: error.message
    }).catch((alertError) => {
      console.error("Failed to send admin error alert", alertError);
    });
  }

  res.status(statusCode).json({
    message: isServerError && env.isProduction ? "Something went wrong" : message,
    details: isServerError && env.isProduction ? null : error.details || null,
    requestId: req.id
  });
}
