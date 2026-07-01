import { Router } from "express";
import { createBetaApplication } from "../controllers/betaApplicationController.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { createBetaApplicationSchema } from "../validators/betaApplicationSchemas.js";

export const publicRoutes = Router();

publicRoutes.post(
  "/beta-applications",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }),
  validate(createBetaApplicationSchema),
  createBetaApplication
);
