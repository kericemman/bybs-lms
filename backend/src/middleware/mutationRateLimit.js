import { env } from "../config/env.js";
import { rateLimit } from "./rateLimit.js";

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const limiter = rateLimit({
  windowMs: env.mutationRateLimitWindowMs,
  max: env.mutationRateLimitMax,
  keyPrefix: "mutation"
});

export function mutationRateLimit(req, res, next) {
  if (!mutatingMethods.has(req.method)) {
    next();
    return;
  }

  limiter(req, res, next);
}
