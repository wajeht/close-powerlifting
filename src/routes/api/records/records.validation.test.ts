import { describe, expect, it } from "vite-plus/test";

import {
  getRecordsByEquipmentParamValidation,
  getRecordsBySexOrWeightClassParamValidation,
  getRecordsByWeightClassSexParamValidation,
  getRecordsQueryValidation,
} from "./records.validation";

describe("getRecordsQueryValidation", () => {
  it("accepts an empty query", () => {
    expect(getRecordsQueryValidation.safeParse({}).success).toBe(true);
  });

  it("accepts a valid age_class", () => {
    expect(getRecordsQueryValidation.safeParse({ age_class: "40-44" }).success).toBe(true);
  });

  it("rejects an unknown age_class", () => {
    expect(getRecordsQueryValidation.safeParse({ age_class: "12-2000" }).success).toBe(false);
  });
});

describe("getRecordsByEquipmentParamValidation", () => {
  it("accepts each equipment value", () => {
    for (const eq of ["raw", "wraps", "single", "multi", "unlimited", "all-tested"]) {
      expect(getRecordsByEquipmentParamValidation.safeParse({ equipment: eq }).success).toBe(true);
    }
  });

  it("rejects an unknown equipment", () => {
    expect(getRecordsByEquipmentParamValidation.safeParse({ equipment: "denim" }).success).toBe(
      false,
    );
  });
});

describe("getRecordsByWeightClassSexParamValidation", () => {
  it("requires all three params", () => {
    expect(
      getRecordsByWeightClassSexParamValidation.safeParse({
        equipment: "raw",
        weight_class: "ipf-classes",
        sex: "men",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown weight_class system", () => {
    expect(
      getRecordsByWeightClassSexParamValidation.safeParse({
        equipment: "raw",
        weight_class: "metric-classes",
        sex: "men",
      }).success,
    ).toBe(false);
  });
});

describe("getRecordsBySexOrWeightClassParamValidation", () => {
  it("accepts a sex segment", () => {
    expect(
      getRecordsBySexOrWeightClassParamValidation.safeParse({
        equipment: "raw",
        sex_or_weight_class: "men",
      }).success,
    ).toBe(true);
  });

  it("accepts a numeric weight-class segment", () => {
    expect(
      getRecordsBySexOrWeightClassParamValidation.safeParse({
        equipment: "raw",
        sex_or_weight_class: "82.5",
      }).success,
    ).toBe(true);
  });
});
