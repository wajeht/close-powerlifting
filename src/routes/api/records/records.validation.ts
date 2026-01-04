import { z } from "zod";

export const recordsEquipmentEnum = z.enum([
  "raw",
  "wraps",
  "raw-wraps",
  "single-ply",
  "multi-ply",
  "unlimited",
]);
export const recordsSexEnum = z.enum(["men", "women"]);

export const getRecordsValidation = z.object({});

export const getFilteredRecordsParamValidation = z.object({
  equipment: recordsEquipmentEnum.optional(),
  sex: recordsSexEnum.optional(),
});

export const getFilteredRecordsQueryValidation = z.object({});

export type GetRecordsType = z.infer<typeof getRecordsValidation>;
export type GetFilteredRecordsParamType = z.infer<typeof getFilteredRecordsParamValidation>;
export type GetFilteredRecordsQueryType = z.infer<typeof getFilteredRecordsQueryValidation>;
