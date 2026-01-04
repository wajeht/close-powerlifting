import { z } from "zod";

export const getMeetParamValidation = z.object({
  meet: z.union([z.string(), z.array(z.string())]).transform((val) => {
    return Array.isArray(val) ? val.join("/") : val;
  }),
});

export const getMeetQueryValidation = z.object({});

export type GetMeetParamType = z.infer<typeof getMeetParamValidation>;
export type GetMeetQueryType = z.infer<typeof getMeetQueryValidation>;
