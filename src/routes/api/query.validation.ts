import { z } from "zod";

import { configuration } from "../../configuration";

const { maxPerPage } = configuration.pagination;

const positiveIntegerString = z.string().trim().regex(/^\d+$/, {
  message: "Expected a positive integer",
});

export const perPageValidation = positiveIntegerString.transform((val) => {
  const parsed = Number(val);
  return Math.min(Math.max(1, parsed), maxPerPage);
});

export const currentPageValidation = z
  .string()
  .trim()
  .regex(/^-?\d+$/, { message: "Expected an integer" })
  .transform((val) => Math.max(1, Number(val)));

export const yearValidation = z
  .string()
  .trim()
  .regex(/^\d{4}$/, { message: "Expected a four-digit year" })
  .transform((val) => Number(val));

export const yearPathValidation = z
  .string()
  .trim()
  .regex(/^\d{4}$/, {
    message: "Expected a four-digit year",
  });

export const federationSlugValidation = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, {
    message: "Expected a federation slug",
  });
