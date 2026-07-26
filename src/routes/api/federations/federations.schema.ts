import { z } from "@hono/zod-openapi";

import {
  currentPageValidation,
  federationSlugValidation,
  perPageValidation,
  yearValidation,
} from "../query.validation";

export const getFederationsValidation = z.object({
  current_page: currentPageValidation.optional(),
  per_page: perPageValidation.optional(),
});

export const getFederationsParamValidation = z.object({
  federation: federationSlugValidation,
});

export const getFederationMeetsQueryValidation = z.object({
  year: yearValidation.optional(),
});

export type GetFederationsType = z.infer<typeof getFederationsValidation>;
export type GetFederationsParamType = z.infer<typeof getFederationsParamValidation>;
export type GetFederationMeetsQueryType = z.infer<typeof getFederationMeetsQueryValidation>;

export const FederationRow = z
  .object({
    slug: z.string(),
    code: z.string(),
    parent_slug: z.string().nullable(),
    meet_count: z.number(),
  })
  .openapi("FederationRow");

const FederationMeet = z
  .object({
    path: z.string(),
    meet_name: z.string(),
    date: z.string(),
    country: z.string().nullable(),
    state: z.string().nullable(),
    town: z.string().nullable(),
    sanctioned: z.boolean(),
  })
  .openapi("FederationMeet");

export const FederationDetail = FederationRow.extend({
  meets: z.array(FederationMeet),
}).openapi("FederationDetail");

export const FederationStats = z
  .object({
    slug: z.string(),
    code: z.string(),
    parent_slug: z.string().nullable(),
    total_meets: z.number(),
    meets_by_year: z.array(
      z.object({
        year: z.number(),
        meet_count: z.number(),
      }),
    ),
  })
  .openapi("FederationStats");
