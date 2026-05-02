import { z } from "zod";

import {
  currentPageValidation,
  federationSlugValidation,
  perPageValidation,
  yearValidation,
} from "../query.validation";

export const getFederationsValidation = z.object({
  per_page: perPageValidation.optional(),
  current_page: currentPageValidation.optional(),
});

export const getFederationsQueryValidation = z.object({
  year: yearValidation.optional(),
});

export const getFederationsParamValidation = z.object({ federation: federationSlugValidation });

export type GetFederationsType = z.infer<typeof getFederationsValidation>;
export type GetFederationsParamType = z.infer<typeof getFederationsParamValidation>;
export type GetFederationsQueryType = z.infer<typeof getFederationsQueryValidation>;
