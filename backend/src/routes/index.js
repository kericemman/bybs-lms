import { Router } from "express";
import { auditAdminAction } from "../middleware/auditLog.js";
import { adminContentRoutes } from "./adminContentRoutes.js";
import { assignmentRoutes } from "./assignmentRoutes.js";
import { authRoutes } from "./authRoutes.js";
import { cohortRoutes } from "./cohortRoutes.js";
import { dashboardRoutes } from "./dashboardRoutes.js";
import { mentorRoutes } from "./mentorRoutes.js";
import { publicRoutes } from "./publicRoutes.js";
import { studentRoutes } from "./studentRoutes.js";
import { userRoutes } from "./userRoutes.js";

export const apiRoutes = Router();

apiRoutes.use(auditAdminAction);
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/public", publicRoutes);
apiRoutes.use("/dashboards", dashboardRoutes);
apiRoutes.use("/users", userRoutes);
apiRoutes.use("/mentor", mentorRoutes);
apiRoutes.use("/student", studentRoutes);
apiRoutes.use("/cohorts", cohortRoutes);
apiRoutes.use("/assignments", assignmentRoutes);
apiRoutes.use("/admin", adminContentRoutes);
