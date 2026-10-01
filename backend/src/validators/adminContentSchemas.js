import { z } from "zod";
import { emptyToUndefined, httpUrlSchema, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const discussionAudienceSchema = z.enum(["all", "mentorsAdmins", "mentorsOnly", "mentorsMentees"]);

export const listByCohortSchema = z.object({
  query: paginationQuerySchema.extend({
    cohort: objectIdSchema.optional(),
    discussion: objectIdSchema.optional(),
    module: objectIdSchema.optional(),
    status: z.string().trim().optional(),
    audience: discussionAudienceSchema.optional()
  })
});

export const createModuleSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    cohort: objectIdSchema,
    assignedMentor: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    order: z.coerce.number().int().min(0).default(0),
    status: z.enum(["draft", "published", "archived"]).default("draft")
  })
});

export const updateModuleSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: createModuleSchema.shape.body.partial()
});

export const createSessionSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    cohort: objectIdSchema,
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    startsAt: z.coerce.date(),
    endsAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    zoomLink: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    recordingLink: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    slidesUrl: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    status: z.enum(["scheduled", "completed", "cancelled"]).default("scheduled")
  })
});

export const updateSessionSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: createSessionSchema.shape.body.partial()
});

export const updateAdminSessionAttendanceSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    records: z.array(z.object({
      student: objectIdSchema,
      status: z.enum(["notMarked", "present", "absent", "late", "excused"])
    })).min(1).max(1000),
    reason: z.string().trim().min(5).max(500),
    markCompleted: z.boolean().default(false),
    expectedUpdatedAt: z.coerce.date().optional()
  })
});

export const createResourceSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    type: z.enum(["slides", "pdf", "template", "zoom", "recording", "reading", "external", "video", "reflection"]),
    url: httpUrlSchema,
    fileType: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    cohort: objectIdSchema,
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    session: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    visibility: z.enum(["draft", "published"]).default("draft")
  })
});

export const updateResourceSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: createResourceSchema.shape.body.partial()
});

export const createDiscussionSchema = z.object({
  body: z.object({
    cohort: objectIdSchema,
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    title: z.string().trim().min(2),
    body: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    audience: discussionAudienceSchema.default("all"),
    status: z.enum(["open", "closed", "archived"]).default("open")
  })
});

export const updateDiscussionSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    cohort: objectIdSchema.optional(),
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    title: z.string().trim().min(2).optional(),
    body: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    audience: discussionAudienceSchema.optional(),
    status: z.enum(["open", "closed", "archived"]).optional()
  })
});

export const listBookingsSchema = z.object({
  query: paginationQuerySchema.extend({
    booking: objectIdSchema.optional(),
    mentor: objectIdSchema.optional(),
    student: objectIdSchema.optional(),
    status: z.enum(["pending", "approved", "declined", "completed", "cancelled"]).optional()
  })
});

export const updateBookingSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["pending", "approved", "declined", "completed", "cancelled"]).optional(),
    meetingLink: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    mentorNotes: z.preprocess(emptyToUndefined, z.string().trim().optional())
  })
});

export const listReportsSchema = z.object({
  query: paginationQuerySchema.extend({
    report: objectIdSchema.optional(),
    cohort: objectIdSchema.optional(),
    mentor: objectIdSchema.optional(),
    period: z.enum(["weekly", "monthly"]).optional(),
    reviewStatus: z.enum(["submitted", "reviewed", "clarificationRequested", "resolved"]).optional()
  })
});

export const updateReportReviewSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    reviewStatus: z.enum(["submitted", "reviewed", "clarificationRequested", "resolved"]).optional(),
    comment: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional())
  }).refine((body) => body.reviewStatus || body.comment, {
    message: "Add a comment or choose a review status"
  })
});

export const listSupportTicketsSchema = z.object({
  query: paginationQuerySchema.extend({
    ticket: objectIdSchema.optional(),
    status: z.enum(["open", "inProgress", "resolved", "closed"]).optional(),
    category: z.enum(["login", "assignment", "mentor", "resourceAccess", "technical", "general"]).optional()
  })
});

export const updateSupportTicketSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["open", "inProgress", "resolved", "closed"]).optional(),
    assignedTo: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    reply: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional())
  })
});

export const listNotificationsSchema = z.object({
  query: paginationQuerySchema.extend({
    type: z.enum(["announcement", "assignment", "booking", "support", "reminder", "question", "system"]).optional(),
    recipient: objectIdSchema.optional()
  })
});

export const listAnnouncementsSchema = z.object({
  query: paginationQuerySchema.extend({
    type: z.enum(["announcement", "assignment", "booking", "support", "reminder", "system"]).optional(),
    channel: z.enum(["platform", "email", "both"]).optional()
  })
});

export const announcementParamsSchema = z.object({
  params: z.object({
    id: z.string().trim().min(6).max(140)
  })
});

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    message: z.string().trim().min(5),
    type: z.enum(["announcement", "assignment", "booking", "support", "reminder", "system"]).default("announcement"),
    channel: z.enum(["platform", "email", "both"]).default("platform"),
    previewText: z.preprocess(emptyToUndefined, z.string().trim().max(180).optional()),
    ctaLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
    ctaUrl: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    targetType: z.enum(["all", "cohort", "role", "user"]).default("all"),
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    role: z.enum(["student", "mentor", "admin", "adminManager", "superAdmin"]).optional(),
    recipient: z.preprocess(emptyToUndefined, objectIdSchema.optional())
  })
});

export const listSystemLogsSchema = z.object({
  query: paginationQuerySchema.extend({
    log: objectIdSchema.optional(),
    action: z.string().trim().optional(),
    statusCode: z.coerce.number().int().optional()
  })
});
