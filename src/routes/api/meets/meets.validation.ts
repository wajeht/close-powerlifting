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
  sort: z.enum(["date-desc", "date-asc"]).default("date-desc").optional(),
});

export const getMeetParamValidation = z.object({
  federation: federationSlugValidation,
  date: isoDateValidation,
  slug: z.string().trim().min(1),
});

export const getMeetQueryValidation = z.object({
  sort: z.enum(["place", "by-total", "by-dots"]).default("place").optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getMeetHighlightsQueryValidation = z.object({
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type ListMeetsQueryType = z.infer<typeof listMeetsQueryValidation>;
export type GetMeetParamType = z.infer<typeof getMeetParamValidation>;
export type GetMeetQueryType = z.infer<typeof getMeetQueryValidation>;
export type GetMeetHighlightsQueryType = z.infer<typeof getMeetHighlightsQueryValidation>;
