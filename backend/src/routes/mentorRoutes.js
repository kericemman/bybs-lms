import { Router } from "express";
import {
  createMentorAvailability,
  createMentorDiscussion,
  createMentorReport,
  createAssignmentReminder,
  archiveAssignmentReminder,
  createSessionWork,
  archiveMentorDiscussion,
  deleteMentorAvailability,
  deleteMentorDiscussionComment,
  archiveMentorReport,
  getMentorStudent,
  getMentorSessionAttendance,
  approveStudentGraduation,
  listMentorAvailability,
  listMentorAssignments,
  listAssignmentReminders,
  listMentorBookings,
  listMentorDiscussions,
  listMentorModules,
  listMentorNotifications,
  listMentorReports,
  listMentorSessions,
  listMentorStudents,
  listMentorSubmissions,
  mentorDashboard,
  reviewSubmission,
  replyMentorDiscussion,
  markMentorNotificationRead,
  sendMentorStudentMessage,
  updateMentorDiscussion,
  updateMentorDiscussionComment,
  updateAssignmentReminder,
  updateMentorAvailability,
  updateMentorBooking,
  updateMentorSessionAttendance,
  updateMentorReport
} from "../controllers/mentorController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { decompressCompressedUpload, finalizeResourceUpload, resourceUpload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { uploadResourceFile } from "../controllers/uploadController.js";
import { createBetaFeedback, listMyBetaFeedback } from "../controllers/betaFeedbackController.js";
import { idParamsSchema } from "../validators/commonSchemas.js";
import {
  mentorGraduationApprovalSchema
} from "../validators/certificateSchemas.js";
import {
  createAvailabilitySchema,
  createAssignmentReminderSchema,
  updateAssignmentReminderSchema,
  createMentorReportSchema,
  createSessionWorkSchema,
  mentorSessionAttendanceSchema,
  mentorAssignmentListSchema,
  mentorBookingListSchema,
  mentorListSchema,
  mentorSessionListSchema,
  mentorStudentDetailSchema,
  mentorSubmissionListSchema,
  reviewSubmissionSchema,
  sendMentorStudentMessageSchema,
  updateAvailabilitySchema,
  updateMentorBookingSchema,
  updateMentorSessionAttendanceSchema,
  updateMentorReportSchema
} from "../validators/mentorSchemas.js";
import { createBetaFeedbackSchema, listMyBetaFeedbackSchema } from "../validators/betaFeedbackSchemas.js";
import {
  createDiscussionCommentSchema,
  createPortalDiscussionSchema,
  discussionCommentParamsSchema,
  discussionListSchema,
  updateDiscussionCommentSchema,
  updatePortalDiscussionSchema
} from "../validators/discussionSchemas.js";

export const mentorRoutes = Router();

mentorRoutes.use(requireAuth, requireRole("mentor"));

mentorRoutes.get("/dashboard", mentorDashboard);
mentorRoutes.get("/modules", validate(mentorListSchema), listMentorModules);
mentorRoutes.get("/sessions", validate(mentorSessionListSchema), listMentorSessions);
mentorRoutes.get("/sessions/:id/attendance", validate(mentorSessionAttendanceSchema), getMentorSessionAttendance);
mentorRoutes.patch("/sessions/:id/attendance", validate(updateMentorSessionAttendanceSchema), updateMentorSessionAttendance);
mentorRoutes.get("/discussions", validate(discussionListSchema), listMentorDiscussions);
mentorRoutes.post("/discussions", validate(createPortalDiscussionSchema), createMentorDiscussion);
mentorRoutes.patch("/discussions/:id", validate(updatePortalDiscussionSchema), updateMentorDiscussion);
mentorRoutes.delete("/discussions/:id", validate(idParamsSchema), archiveMentorDiscussion);
mentorRoutes.post("/discussions/:id/comments", validate(createDiscussionCommentSchema), replyMentorDiscussion);
mentorRoutes.patch("/discussions/:id/comments/:commentId", validate(updateDiscussionCommentSchema), updateMentorDiscussionComment);
mentorRoutes.delete("/discussions/:id/comments/:commentId", validate(discussionCommentParamsSchema), deleteMentorDiscussionComment);
mentorRoutes.get("/assignments", validate(mentorAssignmentListSchema), listMentorAssignments);
mentorRoutes.get("/assignment-reminders", validate(mentorListSchema), listAssignmentReminders);
mentorRoutes.post("/assignment-reminders", validate(createAssignmentReminderSchema), createAssignmentReminder);
mentorRoutes.patch("/assignment-reminders/:id", validate(updateAssignmentReminderSchema), updateAssignmentReminder);
mentorRoutes.delete("/assignment-reminders/:id", validate(idParamsSchema), archiveAssignmentReminder);
mentorRoutes.post("/uploads", resourceUpload.single("file"), decompressCompressedUpload, finalizeResourceUpload, uploadResourceFile);
mentorRoutes.post("/session-work", validate(createSessionWorkSchema), createSessionWork);
mentorRoutes.get("/students", validate(mentorListSchema), listMentorStudents);
mentorRoutes.get("/students/:id", validate(mentorStudentDetailSchema), getMentorStudent);
mentorRoutes.post("/students/:id/messages", validate(sendMentorStudentMessageSchema), sendMentorStudentMessage);
mentorRoutes.post("/students/:id/graduation-approval", validate(mentorGraduationApprovalSchema), approveStudentGraduation);
mentorRoutes.get("/submissions", validate(mentorSubmissionListSchema), listMentorSubmissions);
mentorRoutes.patch("/submissions/:id/review", validate(reviewSubmissionSchema), reviewSubmission);

mentorRoutes.get("/availability", listMentorAvailability);
mentorRoutes.post("/availability", validate(createAvailabilitySchema), createMentorAvailability);
mentorRoutes.patch("/availability/:id", validate(updateAvailabilitySchema), updateMentorAvailability);
mentorRoutes.delete("/availability/:id", validate(idParamsSchema), deleteMentorAvailability);

mentorRoutes.get("/bookings", validate(mentorBookingListSchema), listMentorBookings);
mentorRoutes.patch("/bookings/:id", validate(updateMentorBookingSchema), updateMentorBooking);

mentorRoutes.get("/notifications", validate(mentorListSchema), listMentorNotifications);
mentorRoutes.patch("/notifications/:id/read", validate(idParamsSchema), markMentorNotificationRead);

mentorRoutes.get("/reports", validate(mentorListSchema), listMentorReports);
mentorRoutes.post("/reports", validate(createMentorReportSchema), createMentorReport);
mentorRoutes.patch("/reports/:id", validate(updateMentorReportSchema), updateMentorReport);
mentorRoutes.delete("/reports/:id", validate(idParamsSchema), archiveMentorReport);

mentorRoutes.get("/beta-feedback", validate(listMyBetaFeedbackSchema), listMyBetaFeedback);
mentorRoutes.post("/beta-feedback", validate(createBetaFeedbackSchema), createBetaFeedback);
