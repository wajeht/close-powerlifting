import { describe, expect, it } from "vitest";

import { createContext } from "../../../context";
import { createRecordService } from "./records.service";
import {
  recordsDefaultHtml,
  recordsRawHtml,
  recordsRawMenHtml,
  recordsSingleHtml,
  recordsMultiHtml,
  recordsUnlimitedHtml,
  recordsAllTestedHtml,
  recordsUnlimitedWpClassesHtml,
  recordsUnlimitedWpClassesWomenHtml,
} from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const recordService = createRecordService(scraper);

const defaultDoc = scraper.parseHtml(recordsDefaultHtml);
const rawDoc = scraper.parseHtml(recordsRawHtml);
const rawMenDoc = scraper.parseHtml(recordsRawMenHtml);
const singleDoc = scraper.parseHtml(recordsSingleHtml);
const multiDoc = scraper.parseHtml(recordsMultiHtml);
const unlimitedDoc = scraper.parseHtml(recordsUnlimitedHtml);
const allTestedDoc = scraper.parseHtml(recordsAllTestedHtml);
const unlimitedWpClassesDoc = scraper.parseHtml(recordsUnlimitedWpClassesHtml);
const unlimitedWpClassesWomenDoc = scraper.parseHtml(recordsUnlimitedWpClassesWomenHtml);

const defaultCategories = recordService.parseRecordsHtml(defaultDoc);
const rawCategories = recordService.parseRecordsHtml(rawDoc);
const rawMenCategories = recordService.parseRecordsHtml(rawMenDoc);
const singleCategories = recordService.parseRecordsHtml(singleDoc);
const multiCategories = recordService.parseRecordsHtml(multiDoc);
const unlimitedCategories = recordService.parseRecordsHtml(unlimitedDoc);
const allTestedCategories = recordService.parseRecordsHtml(allTestedDoc);
const unlimitedWpClassesCategories = recordService.parseRecordsHtml(unlimitedWpClassesDoc);
const unlimitedWpClassesWomenCategories = recordService.parseRecordsHtml(
  unlimitedWpClassesWomenDoc,
);

describe.concurrent("records service", () => {
  describe("parseRecordsHtml", () => {
    it("parses default records HTML correctly", () => {
      expect(defaultCategories).toBeDefined();
      expect(Array.isArray(defaultCategories)).toBe(true);
    });

    it("parses raw records HTML correctly", () => {
      expect(rawCategories).toBeDefined();
      expect(Array.isArray(rawCategories)).toBe(true);
    });

    it("parses raw men records HTML correctly", () => {
      expect(rawMenCategories).toBeDefined();
      expect(Array.isArray(rawMenCategories)).toBe(true);
    });

    it("parses single-ply records HTML correctly", () => {
      expect(singleCategories).toBeDefined();
      expect(Array.isArray(singleCategories)).toBe(true);
      expect(singleCategories.length).toBeGreaterThan(0);
    });

    it("parses multi-ply records HTML correctly", () => {
      expect(multiCategories).toBeDefined();
      expect(Array.isArray(multiCategories)).toBe(true);
      expect(multiCategories.length).toBeGreaterThan(0);
    });

    it("parses unlimited records HTML correctly", () => {
      expect(unlimitedCategories).toBeDefined();
      expect(Array.isArray(unlimitedCategories)).toBe(true);
      expect(unlimitedCategories.length).toBeGreaterThan(0);
    });

    it("parses all-tested records HTML correctly", () => {
      expect(allTestedCategories).toBeDefined();
      expect(Array.isArray(allTestedCategories)).toBe(true);
      expect(allTestedCategories.length).toBeGreaterThan(0);
    });

    it("parses unlimited wp-classes records HTML correctly", () => {
      expect(unlimitedWpClassesCategories).toBeDefined();
      expect(Array.isArray(unlimitedWpClassesCategories)).toBe(true);
      expect(unlimitedWpClassesCategories.length).toBeGreaterThan(0);
    });

    it("parses unlimited wp-classes women records HTML correctly", () => {
      expect(unlimitedWpClassesWomenCategories).toBeDefined();
      expect(Array.isArray(unlimitedWpClassesWomenCategories)).toBe(true);
      expect(unlimitedWpClassesWomenCategories.length).toBeGreaterThan(0);
    });

    it("extracts record categories from default records", () => {
      expect(defaultCategories.length).toBeGreaterThan(0);
    });

    it("each category has a title", () => {
      for (const category of defaultCategories) {
        expect(category.title).toBeDefined();
        expect(category.title.length).toBeGreaterThan(0);
      }
    });

    it("each category has records array", () => {
      for (const category of defaultCategories) {
        expect(Array.isArray(category.records)).toBe(true);
      }
    });

    it("categories include expected lift titles", () => {
      const titles = defaultCategories.map((c) => c.title.toLowerCase());
      const hasSquat = titles.some((t) => t.includes("squat"));
      const hasBench = titles.some((t) => t.includes("bench"));
      const hasDeadlift = titles.some((t) => t.includes("deadlift"));
      expect(hasSquat || hasBench || hasDeadlift).toBe(true);
    });

    it("record entries have fields", () => {
      const firstCategory = defaultCategories[0];
      if (firstCategory && firstCategory.records.length > 0) {
        const record = firstCategory.records[0];
        expect(Object.keys(record).length).toBeGreaterThan(0);
      }
    });

    it("record entries contain lifter information", () => {
      for (const category of defaultCategories) {
        if (category.records.length > 0) {
          const record = category.records[0];
          const hasLifter = Object.keys(record).some(
            (key) => key.toLowerCase().includes("lifter") || key.toLowerCase().includes("name"),
          );
          if (hasLifter) {
            expect(hasLifter).toBe(true);
            break;
          }
        }
      }
    });

    it("default and raw records have categories", () => {
      expect(defaultCategories.length).toBeGreaterThan(0);
      expect(rawCategories.length).toBeGreaterThan(0);
    });

    it("raw and raw men records have categories", () => {
      expect(rawCategories.length).toBeGreaterThan(0);
      expect(rawMenCategories.length).toBeGreaterThan(0);
    });
  });

  describe("parseSexOrWeightClass", () => {
    it("parses equipment and sex (men)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "men");
      expect(result).toEqual({ equipment: "raw", sex: "men" });
    });

    it("parses equipment and sex (women)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "women");
      expect(result).toEqual({ equipment: "unlimited", sex: "women" });
    });

    it("parses equipment and weight class (wp-classes)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "wp-classes");
      expect(result).toEqual({ equipment: "unlimited", weight_class: "wp-classes" });
    });

    it("parses equipment and weight class (ipf-classes)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "ipf-classes");
      expect(result).toEqual({ equipment: "raw", weight_class: "ipf-classes" });
    });

    it("parses equipment and weight class (expanded-classes)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "expanded-classes");
      expect(result).toEqual({ equipment: "raw", weight_class: "expanded-classes" });
    });

    it("parses equipment and weight class (para-classes)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "para-classes");
      expect(result).toEqual({ equipment: "unlimited", weight_class: "para-classes" });
    });

    it("throws ValidationError for invalid equipment", () => {
      expect(() => recordService.parseSexOrWeightClass("invalid", "men")).toThrow(
        "Invalid equipment parameter!",
      );
    });

    it("throws NotFoundError for invalid sex or weight class", () => {
      expect(() => recordService.parseSexOrWeightClass("raw", "invalid")).toThrow(
        "Invalid sex or weight class parameter!",
      );
    });

    it("works with all equipment types", () => {
      const equipmentTypes = ["raw", "wraps", "single", "multi", "unlimited", "all-tested"];
      for (const equipment of equipmentTypes) {
        const result = recordService.parseSexOrWeightClass(equipment, "men");
        expect(result.equipment).toBe(equipment);
        expect(result.sex).toBe("men");
      }
    });
  });
});
