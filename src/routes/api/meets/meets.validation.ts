import { z } from "zod";

export const getMeetParamValidation = z.object({
  meet: z.string(),
});

export const getMeetQueryValidation = z.object({
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

export type GetMeetParamType = z.infer<typeof getMeetParamValidation>;
export type GetMeetQueryType = z.infer<typeof getMeetQueryValidation>;
