import { z } from "zod";

export const userIdParamValidation = z.object({
  id: z.string().transform((value) => parseInt(value, 10)),
});

export const usersQueryValidation = z.object({
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(1, parseInt(value, 10)) : 1)),
  search: z.string().optional(),
});

export const cacheKeyValidation = z.object({
  key: z.string().min(1, { message: "Cache key is required" }),
});

export const cacheQueryValidation = z.object({
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(1, parseInt(value, 10)) : 1)),
  search: z.string().optional(),
});

export const ingestRunsQueryValidation = z.object({
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(1, parseInt(value, 10)) : 1)),
});

export const userHistoryQueryValidation = z.object({
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(1, parseInt(value, 10)) : 1)),
  search: z.string().optional(),
});

export type UserIdParamType = z.infer<typeof userIdParamValidation>;
export type UsersQueryType = z.infer<typeof usersQueryValidation>;
export type CacheKeyType = z.infer<typeof cacheKeyValidation>;
export type CacheQueryType = z.infer<typeof cacheQueryValidation>;
export type IngestRunsQueryType = z.infer<typeof ingestRunsQueryValidation>;
export type UserHistoryQueryType = z.infer<typeof userHistoryQueryValidation>;
