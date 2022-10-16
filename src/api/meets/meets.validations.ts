import { z } from 'zod';

export const getMeetsValidation = z.object({
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
      if (val === 'true') {
        return true;
      }
      if (val === 'false') {
        return false;
      }
    })
    .optional(),
});

export type getMeetsType = z.infer<typeof getMeetsValidation>;
