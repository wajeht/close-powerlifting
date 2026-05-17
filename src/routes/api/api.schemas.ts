// Shared OpenAPI response shapes used across feature routes.
// Keep these minimal — endpoint-specific data fields stay loosely typed
// in the spec; consumers should rely on the published `docs/api.json`
// for full field-level documentation.

import { z } from "@hono/zod-openapi";

export const PaginationSchema = z
  .object({
    current_page: z.number(),
    per_page: z.number(),
    from: z.number(),
    to: z.number(),
    items: z.number(),
    pages: z.number(),
    first_page: z.number(),
    last_page: z.number(),
  })
  .openapi("Pagination");

export const ErrorResponseSchema = z
  .object({
    status: z.literal("fail"),
    request_url: z.string(),
    message: z.string(),
    errors: z.array(z.unknown()),
    data: z.array(z.unknown()),
  })
  .openapi("ErrorResponse");

export function successResponse<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    status: z.literal("success"),
    request_url: z.string(),
    message: z.string(),
    data: dataSchema,
  });
}

export function paginatedResponse<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    status: z.literal("success"),
    request_url: z.string(),
    message: z.string(),
    data: z.array(dataSchema),
    pagination: PaginationSchema,
  });
}

export const jsonContent = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
});

export const errorContent = {
  content: { "application/json": { schema: ErrorResponseSchema } },
};
