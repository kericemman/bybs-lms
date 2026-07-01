import { rateLimit as expressRateLimit } from "express-rate-limit";
import { ApiError } from "../utils/apiError.js";

export function rateLimit({ windowMs, max }) {
  return expressRateLimit({
    windowMs,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_req, _res, next) {
      next(new ApiError(429, "Too many requests. Please wait and try again."));
    }
  });
}
