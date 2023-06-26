import { z } from 'zod';

export const getMeetValidation = z.object({
  meet: z.string(),
});

export type getMeetType = z.infer<typeof getMeetValidation>;
