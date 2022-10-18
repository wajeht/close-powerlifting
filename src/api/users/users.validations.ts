import { z } from 'zod';

export const getUserValidation = z.object({
  username: z.string(),
});

export type getUserType = z.infer<typeof getUserValidation>;
