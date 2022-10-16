import { z } from 'zod';

export const getRankingsValidation = z.object({
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

export type getRankingsType = z.infer<typeof getRankingsValidation>;
