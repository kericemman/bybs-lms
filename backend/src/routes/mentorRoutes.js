import { Router } from "express";
import {
  createMentorAvailability,
  createMentorReport,
  createAssignmentReminder,
  createSessionWork,
  deleteMentorAvailability,
  listMentorAvailability,
  listMentorAssignments,
  listMentorBookings,
  listMentorModules,
  listMentorReports,
  listMentorSessions,
  listMentorStudents,
  listMentorSubmissions,
  mentorDashboard,
  reviewSubmission,
  updateMentorAvailability,
  updateMentorBooking
} from "../controllers/mentorController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { decompressCompressedUpload, finalizeResourceUpload, resourceUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { uploadResourceFile } from "../controllers/uploadController.js";
import { createBetaFeedback, listMyBetaFeedback } from "../controllers/betaFeedbackController.js";
import { idParamsSchema } from "../validators/commonSchemas.js";
import {
  createAvailabilitySchema,
  createAssignmentReminderSchema,
  createMentorReportSchema,
  createSessionWorkSchema,
  mentorAssignmentListSchema,
  mentorBookingListSchema,
  mentorListSchema,
  mentorSessionListSchema,
  mentorSubmissionListSchema,
  reviewSubmissionSchema,
  updateAvailabilitySchema,
  updateMentorBookingSchema
} from "../validators/mentorSchemas.js";
import { createBetaFeedbackSchema, listMyBetaFeedbackSchema } from "../validators/betaFeedbackSchemas.js";

export const mentorRoutes = Router();

mentorRoutes.use(requireAuth, requireRole("mentor"));

mentorRoutes.get("/dashboard", mentorDashboard);
mentorRoutes.get("/modules", validate(mentorListSchema), listMentorModules);
mentorRoutes.get("/sessions", validate(mentorSessionListSchema), listMentorSessions);
mentorRoutes.get("/assignments", validate(mentorAssignmentListSchema), listMentorAssignments);
mentorRoutes.post("/assignment-reminders", validate(createAssignmentReminderSchema), createAssignmentReminder);
mentorRoutes.post("/uploads", resourceUpload.single("file"), decompressCompressedUpload, finalizeResourceUpload, uploadResourceFile);
mentorRoutes.post("/session-work", validate(createSessionWorkSchema), createSessionWork);
mentorRoutes.get("/students", validate(mentorListSchema), listMentorStudents);
mentorRoutes.get("/submissions", validate(mentorSubmissionListSchema), listMentorSubmissions);
mentorRoutes.patch("/submissions/:id/review", validate(reviewSubmissionSchema), reviewSubmission);

mentorRoutes.get("/availability", listMentorAvailability);
mentorRoutes.post("/availability", validate(createAvailabilitySchema), createMentorAvailability);
mentorRoutes.patch("/availability/:id", validate(updateAvailabilitySchema), updateMentorAvailability);
mentorRoutes.delete("/availability/:id", validate(idParamsSchema), deleteMentorAvailability);

mentorRoutes.get("/bookings", validate(mentorBookingListSchema), listMentorBookings);
mentorRoutes.patch("/bookings/:id", validate(updateMentorBookingSchema), updateMentorBooking);

mentorRoutes.get("/reports", validate(mentorListSchema), listMentorReports);
mentorRoutes.post("/reports", validate(createMentorReportSchema), createMentorReport);

mentorRoutes.get("/beta-feedback", validate(listMyBetaFeedbackSchema), listMyBetaFeedback);
mentorRoutes.post("/beta-feedback", validate(createBetaFeedbackSchema), createBetaFeedback);
