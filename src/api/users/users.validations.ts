import { z } from "zod";

export const getUserValidation = z.object({
  username: z.string(),
});

export const getUsersValidation = z.object({
  search: z.string().optional(),
});

export type getUserType = z.infer<typeof getUserValidation>;
export type getUsersType = z.infer<typeof getUsersValidation>;
