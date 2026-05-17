import { z } from "zod";

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
