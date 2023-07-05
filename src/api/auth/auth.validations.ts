import { z } from 'zod';

export const postRegisterValidation = z.object({
  email: z
    .string({ required_error: 'email is required!' })
    .email({ message: 'must be a valid email address!' }),
  name: z.string({ required_error: 'name is required!' }),
});

export const postVerifyEmailValidation = z.object({
  email: z
    .string({ required_error: 'email is required!' })
    .email({ message: 'must be a valid email address!' }),
  token: z.string({ required_error: 'token is required!' }),
});

export const postResetApiKeyValidation = z.object({
  email: z
    .string({ required_error: 'email is required!' })
    .email({ message: 'must be a valid email address!' }),
});

export type postRegisterType = z.infer<typeof postRegisterValidation>;
export type postVerifyEmailType = z.infer<typeof postVerifyEmailValidation>;
export type postResetApiKeyType = z.infer<typeof postResetApiKeyValidation>;
