import { z } from "zod";

export const meetSortEnum = z.enum([
  "by-dots",
  "by-wilks",
  "by-wilks2020",
  "by-glossbrenner",
  "by-goodlift",
  "by-ipf-points",
  "by-mcculloch",
  "by-total",
  "by-ah",
  "by-nasa",
  "by-reshel",
  "by-schwartz-malone",
  "by-division",
]);

export const getMeetParamValidation = z.object({
  meet: z.union([z.string(), z.array(z.string())]).transform((val) => {
    return Array.isArray(val) ? val.join("/") : val;
  }),
});

export const getMeetQueryValidation = z.object({
  sort: meetSortEnum.optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getMeetHighlightsParamValidation = z.object({
  meet: z.union([z.string(), z.array(z.string())]).transform((val) => {
    return Array.isArray(val) ? val.join("/") : val;
  }),
});

export const getMeetHighlightsQueryValidation = z.object({
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type GetMeetParamType = z.infer<typeof getMeetParamValidation>;
export type GetMeetQueryType = z.infer<typeof getMeetQueryValidation>;
export type GetMeetHighlightsParamType = z.infer<typeof getMeetHighlightsParamValidation>;
export type GetMeetHighlightsQueryType = z.infer<typeof getMeetHighlightsQueryValidation>;
