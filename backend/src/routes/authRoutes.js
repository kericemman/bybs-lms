import { Router } from "express";
import { env } from "../config/env.js";
import { changePassword, login, me } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { changePasswordSchema, loginSchema } from "../validators/authSchemas.js";

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
authRoutes.post("/change-password", requireAuth, validate(changePasswordSchema), changePassword);
