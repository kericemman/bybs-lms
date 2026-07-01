import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const listCohortsSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["draft", "active", "completed", "archived"]).optional()
  })
});

export const createCohortSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    status: z.enum(["draft", "active", "completed", "archived"]).default("draft")
  })
});

export const updateCohortSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    title: z.string().trim().min(2).optional(),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    status: z.enum(["draft", "active", "completed", "archived"]).optional()
  })
});
