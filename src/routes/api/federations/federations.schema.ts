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

export const FederationRow = z.unknown().openapi("FederationRow");
export const FederationDetail = z.unknown().openapi("FederationDetail");
export const FederationStats = z.unknown().openapi("FederationStats");
