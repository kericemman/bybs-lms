import { Router } from "express";
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment
} from "../controllers/assignmentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createAssignmentSchema,
  listAssignmentsSchema,
  updateAssignmentSchema
} from "../validators/assignmentSchemas.js";
import { idParamsSchema } from "../validators/commonSchemas.js";

export const assignmentRoutes = Router();

assignmentRoutes.use(requireAuth, requireRole("admin", "adminManager", "superAdmin", "mentor"));
assignmentRoutes.get("/", validate(listAssignmentsSchema), listAssignments);
assignmentRoutes.post("/", validate(createAssignmentSchema), createAssignment);
assignmentRoutes.patch("/:id", validate(updateAssignmentSchema), updateAssignment);
assignmentRoutes.delete("/:id", validate(idParamsSchema), requireRole("admin", "superAdmin", "mentor"), deleteAssignment);
