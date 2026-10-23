import { z } from "@hono/zod-openapi";
import { parseWeightClass } from "../../../data/weight-class";

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

export const getFilteredRankingsParamValidation = z.object({
  equipment: equipmentEnum
    .describe("Equipment category; raw-wraps combines raw and wraps")
    .optional(),
  sex: sexEnum.describe("Athlete sex").optional(),
  weight_class: z
    .string()
    .trim()
    .refine((value) => parseWeightClass(value) != null, {
      message: "Expected a weight class such as 84 or 84+",
    })
    .describe("Weight class in kg, such as 84 or 84+; encode + as %2B in URLs")
    .optional(),
  year: yearPathValidation.describe("Competition year, such as 2024").optional(),
  event: eventEnum.describe("Competition event").optional(),
  sort: sortEnum.describe("Ranking metric, highest first; defaults to by-dots").optional(),
});

const baseQuery = z.object({
  current_page: currentPageValidation.describe("Page number, starting at 1").optional(),
  per_page: perPageValidation
    .describe("Results per page; defaults to 100, capped at 500")
    .optional(),
  units: z
    .enum(["lbs", "kg"])
    .default("lbs")
    .describe("Weight units; defaults to lbs. Weight-class boundaries always stay in kg")
    .optional(),
  federation: federationSlugValidation.describe("Federation slug, such as ipf").optional(),
  age_class: ageClassEnum.describe("Age class recorded for the competition entry").optional(),
  tested: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .describe("Entry's OPL tested flag: true or false; omit to include both")
    .optional(),
  country: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe(
      "Exact athlete country recorded for the entry, case-insensitive; not the meet location",
    )
    .optional(),
});

export const getRankingsValidation = baseQuery.extend(getFilteredRankingsParamValidation.shape);

export const getFilteredRankingsQueryValidation = baseQuery;

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
    weight_class_over: z.boolean().describe("True for an open-ended class such as 84+"),
    equipment: EquipmentSchema,
    event: EventSchema,
    tested: z.boolean().describe("Whether the competition entry was recorded as drug tested"),
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
    country: z
      .string()
      .nullable()
      .describe("Athlete country recorded for the competition entry, not the meet location"),
    units: UnitsSchema,
  })
  .openapi("RankingEntry");
