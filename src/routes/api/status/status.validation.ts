import { z } from "zod";

export const getStatusValidation = z.object({
  cache: z
    .string()
    .transform((val) => {
      if (val === "true") {
        return true;
      }
      if (val === "false") {
        return false;
      }
    })
    .optional(),
});

export type GetStatusType = z.infer<typeof getStatusValidation>;
