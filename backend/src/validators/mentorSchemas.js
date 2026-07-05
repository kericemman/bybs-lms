import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time like 09:00 or 18:30");

const dayOfWeekSchema = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export const mentorListSchema = z.object({
  query: paginationQuerySchema
});

export const mentorStudentDetailSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const sendMentorStudentMessageSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    title: z.string().trim().min(2).max(120),
    message: z.string().trim().min(5).max(3000)
  })
});

export const mentorSessionListSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["scheduled", "completed", "cancelled"]).optional()
  })
});

export const mentorSessionAttendanceSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const updateMentorSessionAttendanceSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    records: z
      .array(
        z.object({
          student: objectIdSchema,
          status: z.enum(["present", "absent", "late", "excused"])
        })
      )
      .min(1)
      .max(500),
    markCompleted: z.boolean().default(true)
  })
});

export const mentorSubmissionListSchema = z.object({
  query: paginationQuerySchema.extend({
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    status: z.enum(["notStarted", "submitted", "lateSubmission", "reviewed", "needsRevision", "approved"]).optional()
  })
});

export const mentorAssignmentListSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["draft", "published", "closed", "archived"]).optional()
  })
});

export const createAssignmentReminderSchema = z.object({
  body: z.object({
    assignment: objectIdSchema,
    target: z.enum(["notSubmitted", "lateSubmission", "needsRevision", "allAssigned"]).default("notSubmitted"),
    title: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(120).optional()),
    message: z.string().trim().min(10).max(1200)
  })
});

const sessionMaterialSchema = z
  .object({
    title: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(160).optional()),
    url: z.string().trim().url(),
    fileType: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional())
  })
  .optional();

const assignmentSectionSchema = z
  .object({
    overview: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    tasks: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
    deliverables: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    grading: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    supportNotes: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
  .default({});

const assignmentResourceLinkSchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  url: z.string().trim().url()
});

export const createSessionWorkSchema = z.object({
  body: z.object({
    session: objectIdSchema,
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    materialFile: sessionMaterialSchema,
    recordingTitle: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(160).optional()),
    recordingUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    assignmentTitle: z.string().trim().min(2),
    assignmentBreakdown: z.string().trim().min(10),
    assignmentSections: assignmentSectionSchema,
    resourceLinks: z.array(assignmentResourceLinkSchema).max(10).default([]),
    dueDate: z.coerce.date(),
    maxScore: z.coerce.number().min(1).max(1000).default(100),
    allowResubmission: z.boolean().default(true),
    status: z.enum(["draft", "published"]).default("published")
  })
});

export const reviewSubmissionSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z
    .object({
      score: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(1000).optional()),
      feedback: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
      status: z.enum(["reviewed", "needsRevision", "approved"]).default("reviewed")
    })
    .superRefine((value, context) => {
      if (value.status === "approved" && value.score === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Score is required when approving a submission",
          path: ["score"]
        });
      }

      if (value.status !== "approved" && value.score !== undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Only approved submissions can be scored",
          path: ["score"]
        });
      }
    })
});

export const mentorBookingListSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["pending", "approved", "declined", "completed", "cancelled"]).optional()
  })
});

export const updateMentorBookingSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: z.enum(["approved", "declined", "completed", "cancelled"]).optional(),
    meetingLink: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    mentorNotes: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
});

export const createAvailabilitySchema = z.object({
  body: z.object({
    dayOfWeek: dayOfWeekSchema,
    startTime: timeSchema,
    endTime: timeSchema,
    isActive: z.boolean().default(true)
  })
});

export const updateAvailabilitySchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    dayOfWeek: dayOfWeekSchema.optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    isActive: z.boolean().optional()
  })
});

export const createMentorReportSchema = z.object({
  body: z.object({
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    period: z.enum(["weekly", "monthly"]).default("weekly"),
    activeStudentCount: z.coerce.number().int().min(0).optional(),
    studentsDoingWell: z.array(objectIdSchema).default([]),
    studentsAtRisk: z.array(objectIdSchema).default([]),
    assignmentCompletionSummary: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    attendanceConcerns: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    observations: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    recommendations: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional()),
    supportNeeded: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
});

export const updateMentorReportSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: createMentorReportSchema.shape.body.partial()
});
