import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const questionStatusSchema = z.enum(["open", "answered", "resolved"]);

export const mentorQuestionListSchema = z.object({
  query: paginationQuerySchema.extend({
    question: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    status: questionStatusSchema.optional()
  })
});

export const adminMentorQuestionListSchema = z.object({
  query: mentorQuestionListSchema.shape.query.extend({
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    student: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    mentor: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    assignment: z.preprocess(emptyToUndefined, objectIdSchema.optional())
  })
});

export const createMentorQuestionSchema = z.object({
  body: z
    .object({
      module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
      assignment: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
      subject: z.string().trim().min(3).max(160),
      message: z.string().trim().min(3).max(8000)
    })
    .refine((body) => body.module || body.assignment, {
      message: "Choose a module or assignment",
      path: ["module"]
    })
});

export const mentorQuestionReplySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    message: z.string().trim().min(2).max(8000)
  })
});

export const updateMentorQuestionStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(["open", "resolved"])
  })
});
