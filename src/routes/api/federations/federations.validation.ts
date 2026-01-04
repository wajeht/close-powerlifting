import { z } from "zod";

import { configuration } from "../../../configuration";

const { maxPerPage } = configuration.pagination;

export const getFederationsValidation = z.object({
  per_page: z
    .string()
    .transform((val) => Math.min(Number(val), maxPerPage))
    .optional(),
  current_page: z
    .string()
    .transform((val) => Math.max(1, Number(val)))
    .optional(),
});

export const getFederationsQueryValidation = z.object({
  year: z
    .string()
    .transform((val) => Number(val))
    .optional(),
});

export const getFederationsParamValidation = z.object({ federation: z.string() });

export type GetFederationsType = z.infer<typeof getFederationsValidation>;
export type GetFederationsParamType = z.infer<typeof getFederationsParamValidation>;
export type GetFederationsQueryType = z.infer<typeof getFederationsQueryValidation>;
