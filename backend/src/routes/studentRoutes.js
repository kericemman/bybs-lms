import { Router } from "express";
import { listStudentCertificates } from "../controllers/certificateController.js";
import {
  createStudentBooking,
  createStudentDiscussion,
  createStudentSupportTicket,
  listStudentDiscussions,
  listStudentAssignments,
  listStudentBookings,
  listStudentMaterials,
  listStudentMentorAvailability,
  listStudentModules,
  listStudentNotifications,
  listStudentSessions,
  listStudentSupportTickets,
  markStudentNotificationRead,
  replyStudentSupportTicket,
  replyStudentDiscussion,
  studentDashboard,
  studentProgress,
  submitStudentAssignment,
  updateStudentBooking
} from "../controllers/studentController.js";
import { uploadResourceFile } from "../controllers/uploadController.js";
import { createBetaFeedback, listMyBetaFeedback } from "../controllers/betaFeedbackController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { decompressCompressedUpload, finalizeResourceUpload, resourceUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import {
  createBookingSchema,
  createSupportTicketSchema,
  notificationParamsSchema,
  replySupportTicketSchema,
  studentAssignmentListSchema,
  studentListSchema,
  submitAssignmentSchema,
  updateBookingSchema
} from "../validators/studentSchemas.js";
import { createBetaFeedbackSchema, listMyBetaFeedbackSchema } from "../validators/betaFeedbackSchemas.js";
import {
  createDiscussionCommentSchema,
  createPortalDiscussionSchema,
  discussionListSchema
} from "../validators/discussionSchemas.js";

export const studentRoutes = Router();

studentRoutes.use(requireAuth, requireRole("student"));

studentRoutes.get("/dashboard", studentDashboard);
studentRoutes.get("/modules", validate(studentListSchema), listStudentModules);
studentRoutes.get("/sessions", validate(studentListSchema), listStudentSessions);
studentRoutes.get("/materials", validate(studentListSchema), listStudentMaterials);
studentRoutes.get("/discussions", validate(discussionListSchema), listStudentDiscussions);
studentRoutes.post("/discussions", validate(createPortalDiscussionSchema), createStudentDiscussion);
studentRoutes.post("/discussions/:id/comments", validate(createDiscussionCommentSchema), replyStudentDiscussion);
studentRoutes.get("/assignments", validate(studentAssignmentListSchema), listStudentAssignments);
studentRoutes.post("/assignments/:id/submission", validate(submitAssignmentSchema), submitStudentAssignment);
studentRoutes.get("/progress", studentProgress);
studentRoutes.get("/certificates", listStudentCertificates);
studentRoutes.get("/availability", listStudentMentorAvailability);
studentRoutes.get("/bookings", validate(studentListSchema), listStudentBookings);
studentRoutes.post("/bookings", validate(createBookingSchema), createStudentBooking);
studentRoutes.patch("/bookings/:id", validate(updateBookingSchema), updateStudentBooking);
studentRoutes.get("/support-tickets", validate(studentListSchema), listStudentSupportTickets);
studentRoutes.post("/support-tickets", validate(createSupportTicketSchema), createStudentSupportTicket);
studentRoutes.post("/support-tickets/:id/replies", validate(replySupportTicketSchema), replyStudentSupportTicket);
studentRoutes.get("/notifications", validate(studentListSchema), listStudentNotifications);
studentRoutes.patch("/notifications/:id/read", validate(notificationParamsSchema), markStudentNotificationRead);
studentRoutes.get("/beta-feedback", validate(listMyBetaFeedbackSchema), listMyBetaFeedback);
studentRoutes.post("/beta-feedback", validate(createBetaFeedbackSchema), createBetaFeedback);
studentRoutes.post("/uploads", resourceUpload.single("file"), decompressCompressedUpload, finalizeResourceUpload, uploadResourceFile);
