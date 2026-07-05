import { Router } from "express";
import {
  deleteBetaApplication,
  listBetaApplications,
  sendBetaApplicationAcceptanceEmail,
  updateBetaApplication
} from "../controllers/betaApplicationController.js";
import {
  listBetaFeedback,
  updateBetaFeedback
} from "../controllers/betaFeedbackController.js";
import {
  issueCertificate,
  listAdminCertificates,
  revokeCertificate
} from "../controllers/certificateController.js";
import {
  createAnnouncement,
  createDiscussion,
  createModule,
  createResource,
  createSession,
  deleteAnnouncement,
  deleteDiscussion,
  deleteModule,
  deleteResource,
  deleteSession,
  listAnnouncements,
  listBookings,
  listDiscussions,
  generateModuleSessions,
  listModules,
  listNotifications,
  listReports,
  listResources,
  listSessions,
  listSupportTickets,
  listSystemLogs,
  getSupportTicket,
  updateBooking,
  updateDiscussion,
  updateModule,
  updateReportReview,
  updateResource,
  updateSession,
  updateSupportTicket
} from "../controllers/adminContentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  certificateParamsSchema,
  listCertificatesSchema,
  revokeCertificateSchema
} from "../validators/certificateSchemas.js";
import {
  announcementParamsSchema,
  createAnnouncementSchema,
  createDiscussionSchema,
  listAnnouncementsSchema,
  createModuleSchema,
  createResourceSchema,
  createSessionSchema,
  listBookingsSchema,
  listByCohortSchema,
  listNotificationsSchema,
  listReportsSchema,
  listSupportTicketsSchema,
  listSystemLogsSchema,
  updateBookingSchema,
  updateDiscussionSchema,
  updateModuleSchema,
  updateReportReviewSchema,
  updateResourceSchema,
  updateSessionSchema,
  updateSupportTicketSchema
} from "../validators/adminContentSchemas.js";
import {
  betaApplicationParamsSchema,
  listBetaApplicationsSchema,
  updateBetaApplicationSchema
} from "../validators/betaApplicationSchemas.js";
import {
  betaFeedbackParamsSchema,
  listBetaFeedbackSchema,
  updateBetaFeedbackSchema
} from "../validators/betaFeedbackSchemas.js";
import { idParamsSchema } from "../validators/commonSchemas.js";
import { decompressCompressedUpload, finalizeResourceUpload, resourceUpload } from "../middleware/upload.js";
import { uploadResourceFile } from "../controllers/uploadController.js";

export const adminContentRoutes = Router();

adminContentRoutes.use(requireAuth, requireRole("admin", "adminManager", "superAdmin"));

adminContentRoutes.get("/modules", validate(listByCohortSchema), listModules);
adminContentRoutes.post("/modules", validate(createModuleSchema), createModule);
adminContentRoutes.patch("/modules/:id", validate(updateModuleSchema), updateModule);
adminContentRoutes.delete("/modules/:id", validate(idParamsSchema), requireRole("admin", "superAdmin"), deleteModule);
adminContentRoutes.post("/modules/:id/weekend-sessions", validate(idParamsSchema), generateModuleSessions);

adminContentRoutes.get("/sessions", validate(listByCohortSchema), listSessions);
adminContentRoutes.post("/sessions", validate(createSessionSchema), createSession);
adminContentRoutes.patch("/sessions/:id", validate(updateSessionSchema), updateSession);
adminContentRoutes.delete("/sessions/:id", validate(idParamsSchema), requireRole("admin", "superAdmin"), deleteSession);

adminContentRoutes.get("/resources", validate(listByCohortSchema), listResources);
adminContentRoutes.post(
  "/resources/upload",
  resourceUpload.single("file"),
  decompressCompressedUpload,
  finalizeResourceUpload,
  uploadResourceFile
);
adminContentRoutes.post("/resources", validate(createResourceSchema), createResource);
adminContentRoutes.patch("/resources/:id", validate(updateResourceSchema), updateResource);
adminContentRoutes.delete("/resources/:id", validate(idParamsSchema), requireRole("admin", "superAdmin"), deleteResource);

adminContentRoutes.get("/discussions", validate(listByCohortSchema), listDiscussions);
adminContentRoutes.post("/discussions", validate(createDiscussionSchema), createDiscussion);
adminContentRoutes.patch("/discussions/:id", validate(updateDiscussionSchema), updateDiscussion);
adminContentRoutes.delete("/discussions/:id", validate(idParamsSchema), requireRole("admin", "superAdmin"), deleteDiscussion);

adminContentRoutes.get("/bookings", validate(listBookingsSchema), listBookings);
adminContentRoutes.patch("/bookings/:id", validate(updateBookingSchema), updateBooking);

adminContentRoutes.get("/reports", validate(listReportsSchema), listReports);
adminContentRoutes.patch("/reports/:id/review", validate(updateReportReviewSchema), updateReportReview);

adminContentRoutes.get("/certificates", validate(listCertificatesSchema), listAdminCertificates);
adminContentRoutes.post("/certificates/:id/issue", validate(certificateParamsSchema), requireRole("admin", "superAdmin"), issueCertificate);
adminContentRoutes.post("/certificates/:id/revoke", validate(revokeCertificateSchema), requireRole("admin", "superAdmin"), revokeCertificate);

adminContentRoutes.get("/support-tickets", validate(listSupportTicketsSchema), listSupportTickets);
adminContentRoutes.get("/support-tickets/:id", validate(idParamsSchema), getSupportTicket);
adminContentRoutes.patch("/support-tickets/:id", validate(updateSupportTicketSchema), updateSupportTicket);

adminContentRoutes.get("/notifications", validate(listNotificationsSchema), requireRole("admin", "superAdmin"), listNotifications);
adminContentRoutes.get("/announcements", validate(listAnnouncementsSchema), listAnnouncements);
adminContentRoutes.post("/announcements", validate(createAnnouncementSchema), createAnnouncement);
adminContentRoutes.delete("/announcements/:id", validate(announcementParamsSchema), requireRole("admin", "superAdmin"), deleteAnnouncement);

adminContentRoutes.get("/system-logs", validate(listSystemLogsSchema), requireRole("admin", "superAdmin"), listSystemLogs);

adminContentRoutes.get("/beta-applications", validate(listBetaApplicationsSchema), listBetaApplications);
adminContentRoutes.patch("/beta-applications/:id", validate(updateBetaApplicationSchema), updateBetaApplication);
adminContentRoutes.post("/beta-applications/:id/acceptance-email", validate(betaApplicationParamsSchema), sendBetaApplicationAcceptanceEmail);
adminContentRoutes.delete("/beta-applications/:id", validate(betaApplicationParamsSchema), requireRole("admin", "superAdmin"), deleteBetaApplication);

adminContentRoutes.get("/beta-feedback", validate(listBetaFeedbackSchema), listBetaFeedback);
adminContentRoutes.patch("/beta-feedback/:id", validate(updateBetaFeedbackSchema), updateBetaFeedback);
