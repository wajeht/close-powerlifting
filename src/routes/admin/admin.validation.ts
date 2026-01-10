import { z } from "zod";

export const userIdParamValidation = z.object({
  id: z.string().transform((value) => parseInt(value, 10)),
});

export const updateApiCountValidation = z.object({
  api_call_count: z
    .string()
    .transform((value) => parseInt(value, 10))
    .refine((value) => value >= 0, { message: "API call count must be non-negative" }),
});

export const updateApiLimitValidation = z.object({
  api_call_limit: z
    .string()
    .transform((value) => parseInt(value, 10))
    .refine((value) => value >= 0, { message: "API call limit must be non-negative" }),
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

export type UserIdParamType = z.infer<typeof userIdParamValidation>;
export type UpdateApiCountType = z.infer<typeof updateApiCountValidation>;
export type UpdateApiLimitType = z.infer<typeof updateApiLimitValidation>;
export type UsersQueryType = z.infer<typeof usersQueryValidation>;
export type CacheKeyType = z.infer<typeof cacheKeyValidation>;
export type CacheQueryType = z.infer<typeof cacheQueryValidation>;
