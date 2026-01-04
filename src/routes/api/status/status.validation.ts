import { z } from "zod";

export const getStatusValidation = z.object({});

export type GetStatusType = z.infer<typeof getStatusValidation>;
