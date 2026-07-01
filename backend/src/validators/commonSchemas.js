import { z } from "zod";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional()
});

export function emptyToUndefined(value) {
  return value === "" || value === null ? undefined : value;
}

export const idParamsSchema = z.object({
  params: z.object({
    id: objectIdSchema
  })
});
