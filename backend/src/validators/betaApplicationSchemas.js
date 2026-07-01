import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const betaApplicationStatuses = ["new", "reviewing", "accepted", "waitlisted", "rejected"];
export const betaApplicantTypes = ["student", "mentor"];
export const betaApplicationSources = [
  "BYBS website",
  "BYBS mentor",
  "BYBS student",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Email",
  "Friend or referral",
  "Community event",
  "Other"
];

export const createBetaApplicationSchema = z.object({
  body: z.object({
    applicantType: z.enum(betaApplicantTypes),
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
    location: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
    experienceLevel: z.enum(["beginner", "intermediate", "advanced", "mentor", "notSet"]).default("notSet"),
    availability: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
    motivation: z.string().trim().min(20).max(3000),
    source: z.preprocess(emptyToUndefined, z.enum(betaApplicationSources).optional()),
    consent: z.literal(true)
  })
});

export const listBetaApplicationsSchema = z.object({
  query: paginationQuerySchema.extend({
    applicantType: z.enum(betaApplicantTypes).optional(),
    status: z.enum(betaApplicationStatuses).optional()
  })
});

export const betaApplicationParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const updateBetaApplicationSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    status: z.enum(betaApplicationStatuses).optional(),
    adminNotes: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
});
