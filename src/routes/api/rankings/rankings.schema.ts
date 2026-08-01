import { z } from "@hono/zod-openapi";

import { EquipmentSchema, EventSchema, SexSchema, UnitsSchema } from "../api.schemas";
import {
  currentPageValidation,
  federationSlugValidation,
  perPageValidation,
  yearPathValidation,
} from "../query.validation";

export const equipmentEnum = z.enum([
  "raw",
  "wraps",
  "raw-wraps",
  "single-ply",
  "multi-ply",
  "unlimited",
]);

export const sexEnum = z.enum(["men", "women"]);

export const eventEnum = z.enum(["full-power", "push-pull", "squat", "bench", "deadlift"]);

export const sortEnum = z.enum([
  "by-dots",
  "by-wilks",
  "by-glossbrenner",
  "by-goodlift",
  "by-mcculloch",
  "by-total",
  "by-squat",
  "by-bench",
  "by-deadlift",
]);

export const ageClassEnum = z.enum([
  "5-12",
  "13-15",
  "16-17",
  "18-19",
  "20-23",
  "24-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
  "70-74",
  "75-79",
  "80-84",
  "85-89",
]);

const baseQuery = z.object({
  current_page: currentPageValidation.optional(),
  per_page: perPageValidation.optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
  federation: federationSlugValidation.optional(),
});

export const getRankingsValidation = baseQuery;

export const getFilteredRankingsQueryValidation = baseQuery.extend({
  age_class: ageClassEnum.optional(),
});

export const getFilteredRankingsParamValidation = z.object({
  equipment: equipmentEnum.optional(),
  sex: sexEnum.optional(),
  weight_class: z.string().optional(),
  year: yearPathValidation.optional(),
  event: eventEnum.optional(),
  sort: sortEnum.optional(),
});

export const getRankValidation = z.object({
  rank: z.string().regex(/^\d+$/, { message: "Expected a positive integer rank" }),
});

export type GetRankingsType = z.infer<typeof getRankingsValidation>;
export type GetFilteredRankingsQueryType = z.infer<typeof getFilteredRankingsQueryValidation>;
export type GetFilteredRankingsParamType = z.infer<typeof getFilteredRankingsParamValidation>;
export type GetRankType = z.infer<typeof getRankValidation>;

const nullableNumber = z.number().nullable();

export const RankingEntry = z
  .object({
    rank: z.number(),
    username: z.string(),
    name: z.string(),
    sex: SexSchema.nullable(),
    age: nullableNumber,
    bodyweight: nullableNumber,
    weight_class_kg: nullableNumber,
    equipment: EquipmentSchema,
    event: EventSchema,
    squat: nullableNumber,
    bench: nullableNumber,
    deadlift: nullableNumber,
    total: nullableNumber,
    dots: nullableNumber,
    wilks: nullableNumber,
    glossbrenner: nullableNumber,
    goodlift: nullableNumber,
    federation: z.string(),
    meet_path: z.string(),
    meet_name: z.string(),
    meet_date: z.string(),
    country: z.string().nullable(),
    units: UnitsSchema,
  })
  .openapi("RankingEntry");
