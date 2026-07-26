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

const equipmentGroupEnum = z.enum(["raw", "wraps", "single", "multi", "unlimited", "all-tested"]);
const recordCategoryEnum = z.enum([
  "squat_full_power",
  "squat_all_events",
  "bench_full_power",
  "bench_all_events",
  "deadlift_full_power",
  "deadlift_all_events",
  "total",
]);
const recordSexEnum = z.enum(["M", "F"]);

const RecordEntry = z
  .object({
    weight_class_kg: z.number(),
    rank: z.number(),
    lift_value: z.number(),
    username: z.string(),
    name: z.string(),
    federation: z.string(),
    meet_path: z.string(),
    meet_name: z.string(),
    date: z.string(),
  })
  .openapi("RecordEntry");

const RecordSection = z
  .object({
    sex: recordSexEnum,
    equipment_group: equipmentGroupEnum,
    records: z.array(RecordEntry),
  })
  .openapi("RecordSection");

const RecordCategory = z
  .object({
    key: recordCategoryEnum,
    title: z.string(),
    sections: z.array(RecordSection),
  })
  .openapi("RecordCategory");

export const RecordsData = z
  .object({
    filters: z.object({
      equipment_group: equipmentGroupEnum.nullable(),
      sex: recordSexEnum.nullable(),
      weight_class_kg: z.number().nullable(),
      age_class: z.string().nullable(),
    }),
    categories: z.array(RecordCategory),
  })
  .openapi("RecordsData");
