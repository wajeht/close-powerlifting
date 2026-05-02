import { z } from "zod";

import { currentPageValidation, perPageValidation } from "../query.validation";

export const getUserValidation = z.object({
  username: z.string(),
});

export const getUsersValidation = z.object({
  search: z.string().trim().optional(),
  per_page: perPageValidation.optional(),
  current_page: currentPageValidation.optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getUserQueryValidation = z.object({
  include_attempts: z.enum(["true", "false"]).default("false").optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

const usernameSlug = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, { message: "Expected a username slug" });

export const getCompareValidation = z.object({
  a: usernameSlug,
  b: usernameSlug,
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const userUnitsQueryValidation = z.object({
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type GetUserType = z.infer<typeof getUserValidation>;
export type GetUserQueryType = z.infer<typeof getUserQueryValidation>;
export type GetUsersType = z.infer<typeof getUsersValidation>;
export type GetCompareType = z.infer<typeof getCompareValidation>;
export type UserUnitsQueryType = z.infer<typeof userUnitsQueryValidation>;
