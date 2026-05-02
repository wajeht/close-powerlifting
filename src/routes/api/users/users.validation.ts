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

export type GetUserType = z.infer<typeof getUserValidation>;
export type GetUserQueryType = z.infer<typeof getUserQueryValidation>;
export type GetUsersType = z.infer<typeof getUsersValidation>;
