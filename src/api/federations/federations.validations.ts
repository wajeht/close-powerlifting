import { z } from "zod";

export const getFederationsValidation = z.object({
  per_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  current_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  cache: z
    .string()
    .transform((val) => {
      if (val === "true") {
        return true;
      }
      if (val === "false") {
        return false;
      }
    })
    .optional(),
});

export const getFederationsQueryValidation = z.object({
  year: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  cache: z
    .string()
    .transform((val) => {
      if (val === "true") {
        return true;
      }
      if (val === "false") {
        return false;
      }
    })
    .optional(),
});

export const getFederationsParamValidation = z.object({ federation: z.string() });

export type getFederationsType = z.infer<typeof getFederationsValidation>;
export type getFederationsParamType = z.infer<typeof getFederationsParamValidation>;
export type getFederationsQueryType = z.infer<typeof getFederationsQueryValidation>;
