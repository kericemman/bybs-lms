import { ApiError } from "../utils/apiError.js";

function hasUnsafeKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasUnsafeKey);

  return Object.entries(value).some(([key, nestedValue]) => {
    if (key.startsWith("$") || key.includes(".")) return true;
    return hasUnsafeKey(nestedValue);
  });
}

export function rejectUnsafePayload(req, _res, next) {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    next(new ApiError(400, "Request contains unsafe keys"));
    return;
  }

  next();
}
