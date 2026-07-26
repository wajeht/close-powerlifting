import { z } from "@hono/zod-openapi";

import { EquipmentSchema, EventSchema, PlaceSchema, UnitsSchema } from "../api.schemas";
import { currentPageValidation, perPageValidation } from "../query.validation";

const usernameSlug = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, { message: "Expected a username slug" });

export const getUsersValidation = z.object({
  search: z.string().trim().optional(),
  per_page: perPageValidation.optional(),
  current_page: currentPageValidation.optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getUserParamValidation = z.object({
  username: usernameSlug,
});

export const getUserQueryValidation = z.object({
  include_attempts: z.enum(["true", "false"]).default("false").optional(),
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const userUnitsQueryValidation = z.object({
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export const getCompareValidation = z.object({
  a: usernameSlug,
  b: usernameSlug,
  units: z.enum(["lbs", "kg"]).default("lbs").optional(),
});

export type GetUsersType = z.infer<typeof getUsersValidation>;
export type GetUserParamType = z.infer<typeof getUserParamValidation>;
export type GetUserQueryType = z.infer<typeof getUserQueryValidation>;
export type GetCompareType = z.infer<typeof getCompareValidation>;

const nullableNumber = z.number().nullable();

const LifterMatch = z
  .object({
    username: z.string(),
    name: z.string(),
  })
  .openapi("LifterMatch");

const PersonalBest = z
  .object({
    squat: nullableNumber,
    bench: nullableNumber,
    deadlift: nullableNumber,
    total: nullableNumber,
    dots: nullableNumber,
    wilks: nullableNumber,
    units: UnitsSchema,
  })
  .openapi("PersonalBest");

const ProfileSummary = z
  .object({
    username: z.string(),
    name: z.string(),
    total_entries: z.number(),
    first_meet: z.string().nullable(),
    last_meet: z.string().nullable(),
    personal_best: PersonalBest,
  })
  .openapi("ProfileSummary");

const Attempts = z
  .object({
    squat: z.array(nullableNumber).length(4),
    bench: z.array(nullableNumber).length(4),
    deadlift: z.array(nullableNumber).length(4),
  })
  .openapi("Attempts");

const CompetitionResult = z
  .object({
    date: z.string(),
    meet_name: z.string(),
    meet_path: z.string(),
    federation: z.string(),
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
    attempts: Attempts.optional(),
  })
  .openapi("CompetitionResult");

const RunningPersonalBest = z
  .object({
    squat: nullableNumber,
    bench: nullableNumber,
    deadlift: nullableNumber,
    total: nullableNumber,
    dots: nullableNumber,
  })
  .openapi("RunningPersonalBest");

const ProgressionEntry = z
  .object({
    date: z.string(),
    meet_name: z.string(),
    meet_path: z.string(),
    federation: z.string(),
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
    running_pb: RunningPersonalBest,
    units: UnitsSchema,
  })
  .openapi("ProgressionEntry");

const Rank = z
  .object({
    rank: z.number(),
    out_of: z.number(),
  })
  .nullable()
  .openapi("Rank");

const Ranks = z
  .object({
    dots: Rank,
    wilks: Rank,
    glossbrenner: Rank,
    goodlift: Rank,
    total: Rank,
    squat: Rank,
    bench: Rank,
    deadlift: Rank,
  })
  .openapi("Ranks");

const Deltas = z
  .object({
    squat: nullableNumber,
    bench: nullableNumber,
    deadlift: nullableNumber,
    total: nullableNumber,
    dots: nullableNumber,
  })
  .openapi("Deltas");

export const UserListData = z.array(LifterMatch).openapi("UserListData");

export const UserProfile = ProfileSummary.extend({
  competition_results: z.array(CompetitionResult),
}).openapi("UserProfile");

export const PersonalBests = z
  .object({
    username: z.string(),
    name: z.string(),
    total_meets: z.number(),
    by_equipment: z.array(
      z.object({
        equipment: EquipmentSchema,
        meets: z.number(),
        personal_best: PersonalBest,
      }),
    ),
  })
  .openapi("PersonalBestsByEquipment");

export const Progression = z
  .object({
    username: z.string(),
    name: z.string(),
    meets: z.number(),
    progression: z.array(ProgressionEntry),
  })
  .openapi("ProgressionData");

export const UserRank = z
  .object({
    username: z.string(),
    name: z.string(),
    ranks: Ranks,
  })
  .openapi("UserRank");

export const CompareData = z
  .object({
    a: ProfileSummary,
    b: ProfileSummary,
    deltas: Deltas,
  })
  .openapi("CompareData");
