
import { z } from 'zod';

export const postRegisterValidation = z.object({
  email: z
    .string({ required_error: 'email is required!' })
    .email({ message: 'must be a valid email address!' }),
  name: z.string({ required_error: 'name is required!' }),
});


export type postRegisterType = z.infer<typeof postRegisterValidation>;
