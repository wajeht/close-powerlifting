import { z } from "zod";

const cacheTransform = z
  .string()
  .transform((val) => val === "true")
  .optional();

export const equipmentEnum = z.enum([
  "raw",
  "wraps",
  "raw-wraps",
  "single-ply",
  "multi-ply",
  "unlimited",
]);
export const sexEnum = z.enum(["men", "women"]);
export const sortEnum = z.enum([
  "by-dots",
  "by-wilks",
  "by-glossbrenner",
  "by-total",
  "by-squat",
  "by-bench",
  "by-deadlift",
]);
export const eventEnum = z.enum(["full-power", "push-pull", "squat", "bench", "deadlift"]);

export const getRankingsValidation = z.object({
  per_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  current_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  cache: cacheTransform,
});

export const getFilteredRankingsParamValidation = z.object({
  equipment: equipmentEnum.optional(),
  sex: sexEnum.optional(),
  weight_class: z.string().optional(),
  year: z.string().optional(),
  event: eventEnum.optional(),
  sort: sortEnum.optional(),
});

export const getFilteredRankingsQueryValidation = z.object({
  per_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  current_page: z
    .string()
    .transform((val) => Number(val))
    .optional(),
  cache: cacheTransform,
});

export const getRankValidation = z.object({
  rank: z.string(),
});

export type GetRankingsType = z.infer<typeof getRankingsValidation>;
export type GetFilteredRankingsParamType = z.infer<typeof getFilteredRankingsParamValidation>;
export type GetFilteredRankingsQueryType = z.infer<typeof getFilteredRankingsQueryValidation>;
export type GetRankType = z.infer<typeof getRankValidation>;
