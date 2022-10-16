import { z } from 'zod';

export const postRegister = z.object({
  email: z.string().email(),
});

export type postRegisterType = z.infer<typeof postRegister>;
