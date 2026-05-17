import { z } from "zod";

import {
  currentPageValidation,
  federationSlugValidation,
  perPageValidation,
} from "../query.validation";

const isoDateValidation = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Expected ISO date in YYYY-MM-DD format" });

export const listMeetsQueryValidation = z.object({
  current_page: currentPageValidation.optional(),
  per_page: perPageValidation.optional(),
  federation: federationSlugValidation.optional(),
  from: isoDateValidation.optional(),
  to: isoDateValidation.optional(),
  country: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  sort: z.enum(["date-desc", "date-asc", "by-lifters"]).default("date-desc").optional(),
});

export type ListMeetsQueryType = z.infer<typeof listMeetsQueryValidation>;

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
