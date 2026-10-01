import { z } from "zod";
import { emptyToUndefined, httpUrlSchema, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const studentListSchema = z.object({
  query: paginationQuerySchema.extend({
    booking: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    notification: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    ticket: z.preprocess(emptyToUndefined, objectIdSchema.optional())
  })
});

export const studentAssignmentListSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["published", "closed"]).optional(),
    submissionStatus: z.enum(["notStarted", "submitted", "resubmitted", "lateSubmission", "reviewed", "needsRevision", "approved"]).optional()
  })
});

export const submitAssignmentSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    fileUrl: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    linkUrl: z.preprocess(emptyToUndefined, httpUrlSchema.optional()),
    writtenResponse: z.preprocess(emptyToUndefined, z.string().trim().min(5).max(8000).optional())
  })
});

export const createBookingSchema = z.object({
  body: z.object({
    mentor: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    availabilitySlot: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    startsAt: z.coerce.date(),
    endsAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    reason: z.string().trim().min(5).max(800)
  })
});

export const updateBookingSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: z.enum(["cancelled"])
  })
});

export const createSupportTicketSchema = z.object({
  body: z.object({
    category: z.enum(["login", "assignment", "mentor", "resourceAccess", "technical", "general"]).default("general"),
    subject: z.string().trim().min(3).max(160),
    message: z.string().trim().min(10).max(5000)
  })
});

export const replySupportTicketSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    message: z.string().trim().min(2).max(3000)
  })
});

export const notificationParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});
