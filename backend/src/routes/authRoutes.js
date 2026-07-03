import { Router } from "express";
import { env } from "../config/env.js";
import { changePassword, login, me, updateProfile, updateProfileImage } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { decompressCompressedUpload, finalizeProfileImageUpload, profileImageUpload } from "../middleware/upload.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema, updateProfileSchema } from "../validators/authSchemas.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  rateLimit({
    windowMs: env.loginRateLimitWindowMs,
    max: env.loginRateLimitMax,
    keyPrefix: "login"
  }),
  validate(loginSchema),
  login
);
authRoutes.get("/me", requireAuth, me);
authRoutes.patch("/profile", requireAuth, validate(updateProfileSchema), updateProfile);
authRoutes.post(
  "/profile-image",
  requireAuth,
  profileImageUpload.single("file"),
  decompressCompressedUpload,
  finalizeProfileImageUpload,
  updateProfileImage
);
authRoutes.post("/change-password", requireAuth, validate(changePasswordSchema), changePassword);
