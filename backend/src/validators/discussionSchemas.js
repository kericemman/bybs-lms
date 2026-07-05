import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const discussionAudienceSchema = z.enum(["all", "mentorsAdmins", "mentorsOnly", "mentorsMentees"]);

export const discussionListSchema = z.object({
  query: paginationQuerySchema.extend({
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    status: z.enum(["open", "closed"]).optional(),
    audience: discussionAudienceSchema.optional()
  })
});

export const createPortalDiscussionSchema = z.object({
  body: z.object({
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    module: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    title: z.string().trim().min(2).max(160),
    body: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
    audience: discussionAudienceSchema.default("all")
  })
});

export const createDiscussionCommentSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    body: z.string().trim().min(2).max(5000)
  })
});
