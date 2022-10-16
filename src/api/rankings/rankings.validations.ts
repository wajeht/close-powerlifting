import { z } from 'zod';

export const getRankingsValidation = z.object({
  query: z.object({
    per_page: z
      .number({
        required_error: 'per_page must be a number!',
      })
      .default(100),
    current_page: z
      .number({
        required_error: 'current_page must be a number!',
      })
      .default(1),
    cache: z
      .boolean({
        required_error: 'cache must be a boolean!',
      })
      .default(true),
  }),
});

export type getRankingsType = z.infer<typeof getRankingsValidation>;
