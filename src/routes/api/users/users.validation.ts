import { z } from "zod";

export const getUserValidation = z.object({
  username: z.string(),
});

export const getUsersValidation = z.object({
  search: z.string().optional(),
});

export type GetUserType = z.infer<typeof getUserValidation>;
export type GetUsersType = z.infer<typeof getUsersValidation>;
