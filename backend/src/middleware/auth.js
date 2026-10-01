import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/jwt.js";

function canAccessPortal(user) {
  return user.status === "active" || (user.role === "student" && user.status === "completed");
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  const user = await User.findById(payload.sub).select("-passwordHash +authVersion");

  if (!user || !canAccessPortal(user)) {
    throw new ApiError(401, "Invalid or inactive account");
  }

  if (Number(payload.ver || 0) !== Number(user.authVersion || 0)) {
    throw new ApiError(401, "Invalid or expired session");
  }

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ApiError(403, "You do not have permission to access this resource"));
      return;
    }

    next();
  };
}
