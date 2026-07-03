import { z } from "zod";
import { emptyToUndefined, objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const listCertificatesSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(["mentorApproved", "issued", "revoked"]).optional(),
    cohort: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    student: z.preprocess(emptyToUndefined, objectIdSchema.optional())
  })
});

export const certificateParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});

export const revokeCertificateSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    revokeReason: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional())
  })
});

export const mentorGraduationApprovalSchema = z.object({
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    mentorNotes: z.preprocess(emptyToUndefined, z.string().trim().max(3000).optional())
  })
});

export const verifyCertificateSchema = z.object({
  params: z.object({
    code: z.string().trim().min(8).max(80)
  })
});
