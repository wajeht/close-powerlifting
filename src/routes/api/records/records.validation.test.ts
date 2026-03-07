import { describe, expect, it } from "vitest";

import {
  recordsEquipmentEnum,
  recordsWeightClassEnum,
  recordsSexEnum,
  getRecordsValidation,
  getFilteredRecordsParamValidation,
} from "./records.validation";

describe.concurrent("records validation", () => {
  describe("recordsEquipmentEnum", () => {
    it("accepts all valid equipment values", () => {
      const validValues = ["raw", "wraps", "single", "multi", "unlimited", "all-tested"];
      for (const value of validValues) {
        expect(recordsEquipmentEnum.safeParse(value).success).toBe(true);
      }
    });

    it("rejects invalid equipment value", () => {
      expect(recordsEquipmentEnum.safeParse("equipped").success).toBe(false);
      expect(recordsEquipmentEnum.safeParse("").success).toBe(false);
    });
  });

  describe("recordsWeightClassEnum", () => {
    it("accepts all valid weight class values", () => {
      const validValues = ["expanded-classes", "ipf-classes", "para-classes", "wp-classes"];
      for (const value of validValues) {
        expect(recordsWeightClassEnum.safeParse(value).success).toBe(true);
      }
    });

    it("rejects invalid weight class value", () => {
      expect(recordsWeightClassEnum.safeParse("usapl-classes").success).toBe(false);
      expect(recordsWeightClassEnum.safeParse("").success).toBe(false);
    });
  });

  describe("recordsSexEnum", () => {
    it("accepts men and women", () => {
      expect(recordsSexEnum.safeParse("men").success).toBe(true);
      expect(recordsSexEnum.safeParse("women").success).toBe(true);
    });

    it("rejects invalid sex value", () => {
      expect(recordsSexEnum.safeParse("male").success).toBe(false);
      expect(recordsSexEnum.safeParse("").success).toBe(false);
    });
  });

  describe("getRecordsValidation", () => {
    it("accepts empty object", () => {
      expect(getRecordsValidation.safeParse({}).success).toBe(true);
    });
  });

  describe("getFilteredRecordsParamValidation", () => {
    it("accepts empty object with all optional fields", () => {
      expect(getFilteredRecordsParamValidation.safeParse({}).success).toBe(true);
    });

    it("accepts valid equipment param", () => {
      const result = getFilteredRecordsParamValidation.safeParse({ equipment: "raw" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.equipment).toBe("raw");
      }
    });

    it("accepts valid weight_class param", () => {
      const result = getFilteredRecordsParamValidation.safeParse({ weight_class: "ipf-classes" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight_class).toBe("ipf-classes");
      }
    });

    it("accepts valid sex param", () => {
      const result = getFilteredRecordsParamValidation.safeParse({ sex: "women" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sex).toBe("women");
      }
    });

    it("accepts all params together", () => {
      const result = getFilteredRecordsParamValidation.safeParse({
        equipment: "wraps",
        weight_class: "wp-classes",
        sex: "men",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.equipment).toBe("wraps");
        expect(result.data.weight_class).toBe("wp-classes");
        expect(result.data.sex).toBe("men");
      }
    });

    it("rejects invalid equipment in combination", () => {
      const result = getFilteredRecordsParamValidation.safeParse({
        equipment: "invalid",
        sex: "men",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid sex in combination", () => {
      const result = getFilteredRecordsParamValidation.safeParse({
        equipment: "raw",
        sex: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });
});
