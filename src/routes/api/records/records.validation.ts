import { z } from "zod";

const cacheTransform = z
  .string()
  .transform((val) => val === "true")
  .optional();

export const recordsEquipmentEnum = z.enum([
  "raw",
  "wraps",
  "raw-wraps",
  "single-ply",
  "multi-ply",
  "unlimited",
]);
export const recordsSexEnum = z.enum(["men", "women"]);

export const getRecordsValidation = z.object({
  cache: cacheTransform,
});

export const getFilteredRecordsParamValidation = z.object({
  equipment: recordsEquipmentEnum.optional(),
  sex: recordsSexEnum.optional(),
});

export const getFilteredRecordsQueryValidation = z.object({
  cache: cacheTransform,
});

export type GetRecordsType = z.infer<typeof getRecordsValidation>;
export type GetFilteredRecordsParamType = z.infer<typeof getFilteredRecordsParamValidation>;
export type GetFilteredRecordsQueryType = z.infer<typeof getFilteredRecordsQueryValidation>;
