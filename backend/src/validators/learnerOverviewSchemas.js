import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "./commonSchemas.js";

export const listLearnerOverviewSchema = z.object({
  query: paginationQuerySchema.extend({
    cohort: objectIdSchema,
    status: z.enum(["active", "inactive", "suspended", "completed"]).optional(),
    risk: z.enum(["onTrack", "watch", "needsAttention"]).optional(),
    readiness: z.enum(["ready", "notReady"]).optional()
  })
});

export const learnerOverviewParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});
