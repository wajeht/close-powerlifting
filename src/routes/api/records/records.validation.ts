import { z } from "zod";

export const recordsEquipmentEnum = z.enum([
  "raw",
  "wraps",
  "single",
  "multi",
  "unlimited",
  "all-tested",
]);

export const recordsWeightClassEnum = z.enum([
  "expanded-classes",
  "ipf-classes",
  "para-classes",
  "wp-classes",
]);

export const recordsSexEnum = z.enum(["men", "women"]);

export const recordsAgeClassEnum = z.enum([
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
  "40-49",
  "50-59",
  "60-69",
  "70-79",
  "over80",
]);

export const getRecordsValidation = z.object({
  age_class: recordsAgeClassEnum.optional(),
});

export const getFilteredRecordsParamValidation = z.object({
  equipment: recordsEquipmentEnum.optional(),
  weight_class: recordsWeightClassEnum.optional(),
  sex: recordsSexEnum.optional(),
});

export const getFilteredRecordsQueryValidation = z.object({
  age_class: recordsAgeClassEnum.optional(),
});

export type GetRecordsType = z.infer<typeof getRecordsValidation>;
export type GetFilteredRecordsParamType = z.infer<typeof getFilteredRecordsParamValidation>;
export type GetFilteredRecordsQueryType = z.infer<typeof getFilteredRecordsQueryValidation>;
