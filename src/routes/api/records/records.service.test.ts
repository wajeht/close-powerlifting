import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createRecordsService } from "./records.service";

function service() {
  return createRecordsService(createTestContext().store);
}

describe("records service", () => {
  describe("groupRecords", () => {
    it("returns categories with the expected keys", async () => {
      const result = await service().groupRecords({ ageClass: null });
      const keys = result.categories.map((c) => c.key);
      expect(keys).toContain("squat_full_power");
      expect(keys).toContain("total");
    });

    it("only emits sections for the requested sex", async () => {
      const result = await service().groupRecords({ sex: "F", ageClass: null });
      for (const cat of result.categories) {
        for (const section of cat.sections) {
          expect(section.sex).toBe("F");
        }
      }
    });

    it("only emits sections for the requested equipment group", async () => {
      const result = await service().groupRecords({ equipmentGroup: "raw", ageClass: null });
      for (const cat of result.categories) {
        for (const section of cat.sections) {
          expect(section.equipment_group).toBe("raw");
        }
      }
    });

    it("emits the all-tested bucket for tested fixture lifters", async () => {
      const result = await service().groupRecords({
        equipmentGroup: "all-tested",
        ageClass: null,
      });
      const totalCat = result.categories.find((c) => c.key === "total");
      expect(totalCat).not.toBeUndefined();
      const ruth = totalCat!.sections
        .flatMap((s) => s.records)
        .find((r) => r.weight_class_kg === 60);
      expect(ruth).not.toBeUndefined();
    });

    it("serves age-class records from precomputed rows", async () => {
      const result = await service().groupRecords({
        equipmentGroup: "raw",
        ageClass: "40-44",
      });
      expect(result.filters.age_class).toBe("40-44");
      const totalCat = result.categories.find((c) => c.key === "total");
      const records = totalCat?.sections.flatMap((s) => s.records) ?? [];
      expect(records.some((record) => record.username === "ruthrabbitt")).toBe(true);
    });
  });

  describe("resolveSexOrWeightClass", () => {
    it("maps men/women to a sex filter", () => {
      expect(service().resolveSexOrWeightClass("men")).toEqual({ kind: "sex", value: "M" });
      expect(service().resolveSexOrWeightClass("women")).toEqual({ kind: "sex", value: "F" });
    });

    it("parses a numeric weight class", () => {
      expect(service().resolveSexOrWeightClass("82.5")).toEqual({
        kind: "weightClass",
        value: 82.5,
      });
    });

    it("returns null for anything else", () => {
      expect(service().resolveSexOrWeightClass("ipf-classes")).toBeNull();
    });
  });
});
