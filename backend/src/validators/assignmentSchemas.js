import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const resourceLinkSchema = z.object({
  title: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  url: z.string().trim().url()
});

export const listAssignmentsSchema = z.object({
  query: paginationQuerySchema.extend({
    cohort: objectIdSchema.optional(),
    status: z.enum(["draft", "published", "closed", "archived"]).optional()
  })
});

export const createAssignmentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2),
    instructions: z.string().trim().min(10),
    cohort: objectIdSchema,
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    dueDate: z.coerce.date(),
    templateFileUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    resourceLinks: z.array(resourceLinkSchema).max(10).default([]),
    maxScore: z.coerce.number().min(1).max(1000).default(100),
    allowResubmission: z.boolean().default(true),
    status: z.enum(["draft", "published", "closed", "archived"]).default("draft")
  })
});

export const updateAssignmentSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    title: z.string().trim().min(2).optional(),
    instructions: z.string().trim().min(10).optional(),
    cohort: objectIdSchema.optional(),
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    dueDate: z.coerce.date().optional(),
    templateFileUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    resourceLinks: z.array(resourceLinkSchema).max(10).optional(),
    maxScore: z.coerce.number().min(1).max(1000).optional(),
    allowResubmission: z.boolean().optional(),
    status: z.enum(["draft", "published", "closed", "archived"]).optional()
  })
});
