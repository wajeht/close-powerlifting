import { z } from 'zod';

export const RankingsValidation = z.object({
  query: z.object({
    per_page: z.number().optional(),
    current_page: z.number().optional(),
    cache: z.boolean().optional(),
  }),
});
