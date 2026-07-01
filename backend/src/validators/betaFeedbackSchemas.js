import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const betaFeedbackRoles = ["student", "mentor"];
export const betaFeedbackCategories = [
  "overall",
  "bug",
  "navigation",
  "content",
  "assignments",
  "sessions",
  "notifications",
  "performance",
  "support",
  "featureRequest",
  "other"
];
export const betaFeedbackStatuses = ["new", "reviewed", "resolved"];

export const createBetaFeedbackSchema = z.object({
  body: z.object({
    category: z.enum(betaFeedbackCategories).default("overall"),
    rating: z.coerce.number().int().min(1).max(5),
    subject: z.string().trim().min(2).max(140),
    message: z.string().trim().min(10).max(3000)
  })
});

export const listMyBetaFeedbackSchema = z.object({
  query: paginationQuerySchema.extend({
    category: z.enum(betaFeedbackCategories).optional(),
    status: z.enum(betaFeedbackStatuses).optional()
  })
});

export const listBetaFeedbackSchema = z.object({
  query: paginationQuerySchema.extend({
    role: z.enum(betaFeedbackRoles).optional(),
    category: z.enum(betaFeedbackCategories).optional(),
    status: z.enum(betaFeedbackStatuses).optional()
  })
});

export const betaFeedbackParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const updateBetaFeedbackSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: z.enum(betaFeedbackStatuses).optional(),
    adminNotes: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
});
