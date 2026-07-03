import { Router } from "express";
import { createBetaApplication } from "../controllers/betaApplicationController.js";
import { verifyCertificate } from "../controllers/certificateController.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { createBetaApplicationSchema } from "../validators/betaApplicationSchemas.js";
import { verifyCertificateSchema } from "../validators/certificateSchemas.js";

export const publicRoutes = Router();

publicRoutes.post(
  "/beta-applications",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }),
  validate(createBetaApplicationSchema),
  createBetaApplication
);

publicRoutes.get("/certificates/:code", validate(verifyCertificateSchema), verifyCertificate);
