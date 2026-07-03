import { Router } from "express";
import {
  adminSummary,
  mentorSummary,
  studentSummary
} from "../controllers/dashboardController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/admin", requireAuth, requireRole("admin", "adminManager", "superAdmin"), adminSummary);
dashboardRoutes.get("/mentor", requireAuth, requireRole("mentor"), mentorSummary);
dashboardRoutes.get("/student", requireAuth, requireRole("student"), studentSummary);
