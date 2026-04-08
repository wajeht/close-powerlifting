import { z } from "zod";

import { configuration } from "../../../configuration";

const { maxPerPage } = configuration.pagination;

export const getUserValidation = z.object({
  username: z.string(),
});

export const getUsersValidation = z.object({
  search: z.string().optional(),
  per_page: z
    .string()
    .transform((val) => Math.min(Number(val), maxPerPage))
    .optional(),
  current_page: z
    .string()
    .transform((val) => Math.max(1, Number(val)))
    .optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getUserQueryValidation = z.object({
  include_attempts: z.enum(["true", "false"]).default("false").optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type GetUserType = z.infer<typeof getUserValidation>;
export type GetUserQueryType = z.infer<typeof getUserQueryValidation>;
export type GetUsersType = z.infer<typeof getUsersValidation>;
