import { z } from "@hono/zod-openapi";

import { EquipmentSchema, EventSchema, PlaceSchema, SexSchema, UnitsSchema } from "../api.schemas";
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

const nullableNumber = z.number().nullable();

const MeetLocation = {
  country: z.string().nullable(),
  state: z.string().nullable(),
  town: z.string().nullable(),
};

export const MeetSummary = z
  .object({
    path: z.string(),
    meet_name: z.string(),
    federation: z.string(),
    date: z.string(),
    ...MeetLocation,
    sanctioned: z.boolean(),
  })
  .openapi("MeetSummary");

const MeetResult = z
  .object({
    username: z.string(),
    name: z.string(),
    sex: SexSchema.nullable(),
    age: nullableNumber,
    event: EventSchema,
    equipment: EquipmentSchema,
    weight_class_kg: nullableNumber,
    bodyweight: nullableNumber,
    squat: nullableNumber,
    bench: nullableNumber,
    deadlift: nullableNumber,
    total: nullableNumber,
    dots: nullableNumber,
    place: PlaceSchema,
    units: UnitsSchema,
  })
  .openapi("MeetResult");

const MeetHighlight = z
  .object({
    username: z.string(),
    name: z.string(),
    equipment: EquipmentSchema,
    weight_class_kg: nullableNumber,
    value: z.number(),
  })
  .nullable()
  .openapi("MeetHighlight");

export const MeetDetail = z
  .object({
    path: z.string(),
    meet_name: z.string(),
    federation: z.string(),
    parent_federation: z.string().nullable(),
    date: z.string(),
    ...MeetLocation,
    sanctioned: z.boolean(),
    results: z.array(MeetResult),
  })
  .openapi("MeetDetail");

export const MeetHighlights = z
  .object({
    path: z.string(),
    meet_name: z.string(),
    federation: z.string(),
    date: z.string(),
    highlights: z.object({
      best_total: MeetHighlight,
      best_squat: MeetHighlight,
      best_bench: MeetHighlight,
      best_deadlift: MeetHighlight,
      best_dots: MeetHighlight,
    }),
  })
  .openapi("MeetHighlights");
