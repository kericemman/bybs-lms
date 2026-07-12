import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const discussionAudienceSchema = z.enum(["all", "mentorsAdmins", "mentorsOnly", "mentorsMentees"]);
const discussionReactionSchema = z.enum(["thumbsUp", "heart", "clap", "celebrate", "pray"]);

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
    body: z.string().trim().min(2).max(5000),
    parentComment: z.preprocess(emptyToUndefined, objectIdSchema.optional())
  })
});

export const updatePortalDiscussionSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    title: z.preprocess(emptyToUndefined, z.string().trim().min(2).max(160).optional()),
    body: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
    audience: discussionAudienceSchema.optional()
  }).refine((body) => body.title || body.body || body.audience, {
    message: "Update the title, message, or audience"
  })
});

export const discussionCommentParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    commentId: objectIdSchema
  })
});

export const updateDiscussionCommentSchema = z.object({
  params: z.object({
    id: objectIdSchema,
    commentId: objectIdSchema
  }),
  body: z.object({
    body: z.string().trim().min(2).max(5000)
  })
});

export const discussionReactionSchemaValidator = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    reaction: discussionReactionSchema
  })
});

export const discussionCommentReactionSchemaValidator = z.object({
  params: z.object({
    id: objectIdSchema,
    commentId: objectIdSchema
  }),
  body: z.object({
    reaction: discussionReactionSchema
  })
});
