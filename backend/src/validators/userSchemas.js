import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

const roleSchema = z.enum(["student", "mentor", "admin", "adminManager", "superAdmin"]);
const statusSchema = z.enum(["active", "inactive", "suspended", "removed", "completed"]);
const optionalUrlSchema = z.preprocess(emptyToUndefined, z.string().trim().url().optional());

const welcomeEmailSchema = z
  .object({
    send: z.boolean().default(true),
    websiteUrl: optionalUrlSchema,
    mentorWhatsappUrl: optionalUrlSchema,
    channelUrl: optionalUrlSchema,
    instagramUrl: optionalUrlSchema,
    linkedInUrl: optionalUrlSchema,
    youtubeUrl: optionalUrlSchema,
    facebookUrl: optionalUrlSchema
  })
  .optional();

export const listUsersSchema = z.object({
  query: paginationQuerySchema.extend({
    role: roleSchema.optional(),
    status: statusSchema.optional(),
    cohort: objectIdSchema.optional()
  })
});

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    password: z.string().min(12),
    role: roleSchema,
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    mentor: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    bio: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    expertise: z.array(z.string().trim()).default([]),
    status: statusSchema.default("active"),
    welcomeEmail: welcomeEmailSchema
  })
});

export const updateUserSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    phone: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    mentor: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    bio: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    expertise: z.array(z.string().trim()).optional(),
    status: statusSchema.optional()
  })
});
