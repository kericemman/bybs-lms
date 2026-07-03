import { Router } from "express";
import { createCohort, deleteCohort, listCohorts, updateCohort } from "../controllers/cohortController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createCohortSchema,
  listCohortsSchema,
  updateCohortSchema
} from "../validators/cohortSchemas.js";
import { idParamsSchema } from "../validators/commonSchemas.js";

export const cohortRoutes = Router();

cohortRoutes.use(requireAuth, requireRole("admin", "adminManager", "superAdmin"));
cohortRoutes.get("/", validate(listCohortsSchema), listCohorts);
cohortRoutes.post("/", validate(createCohortSchema), createCohort);
cohortRoutes.patch("/:id", validate(updateCohortSchema), updateCohort);
cohortRoutes.delete("/:id", validate(idParamsSchema), requireRole("admin", "superAdmin"), deleteCohort);
