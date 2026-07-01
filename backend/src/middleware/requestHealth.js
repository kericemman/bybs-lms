import { env } from "../config/env.js";
import { notifyAdminIncident } from "../services/adminAlertService.js";

function cleanRoute(req) {
  return req.originalUrl?.split("?")[0] || req.path || req.url || "unknown route";
}

function shouldSkip(req) {
  const route = cleanRoute(req);
  return route === "/health" || route.startsWith("/uploads");
}

export function monitorRequestHealth(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (!env.adminAlertsEnabled || shouldSkip(req)) return;

    const durationMs = Date.now() - startedAt;

    if (durationMs < env.slowRequestThresholdMs) return;

    const route = cleanRoute(req);

    notifyAdminIncident({
      kind: "slowRequest",
      title: "Website delay detected",
      message: `A request took ${durationMs}ms, which is above the ${env.slowRequestThresholdMs}ms alert threshold.`,
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs
    }).catch((error) => {
      console.error("Failed to send slow request alert", error);
    });
  });

  next();
}
