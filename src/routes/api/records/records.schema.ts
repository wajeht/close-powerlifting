import { z } from "@hono/zod-openapi";

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

export const getRecordsQueryValidation = z.object({
  age_class: recordsAgeClassEnum.optional(),
});

export const getRecordsByEquipmentParamValidation = z.object({
  equipment: recordsEquipmentEnum,
});

export const getRecordsBySexOrWeightClassParamValidation = z.object({
  equipment: recordsEquipmentEnum,
  sex_or_weight_class: z.string().trim().min(1),
});

export const getRecordsByWeightClassSexParamValidation = z.object({
  equipment: recordsEquipmentEnum,
  weight_class: recordsWeightClassEnum,
  sex: recordsSexEnum,
});

export type GetRecordsQueryType = z.infer<typeof getRecordsQueryValidation>;

export const RecordsData = z.unknown().openapi("RecordsData");
