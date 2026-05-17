import { z } from "zod";

import { currentPageValidation, perPageValidation } from "../query.validation";

const usernameSlug = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, { message: "Expected a username slug" });

export const getUsersValidation = z.object({
  search: z.string().trim().optional(),
  per_page: perPageValidation.optional(),
  current_page: currentPageValidation.optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getUserParamValidation = z.object({
  username: usernameSlug,
});

export const getUserQueryValidation = z.object({
  include_attempts: z.enum(["true", "false"]).default("false").optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const userUnitsQueryValidation = z.object({
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getCompareValidation = z.object({
  a: usernameSlug,
  b: usernameSlug,
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type GetUsersType = z.infer<typeof getUsersValidation>;
export type GetUserParamType = z.infer<typeof getUserParamValidation>;
export type GetUserQueryType = z.infer<typeof getUserQueryValidation>;
export type GetCompareType = z.infer<typeof getCompareValidation>;
