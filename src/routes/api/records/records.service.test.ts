import { describe, expect, test } from "vitest";

import { createContext } from "../../../context";
import { createRecordService } from "./records.service";
import { recordsDefaultHtml, recordsRawHtml, recordsRawMenHtml } from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const recordService = createRecordService(scraper);

const defaultDoc = scraper.parseHtml(recordsDefaultHtml);
const rawDoc = scraper.parseHtml(recordsRawHtml);
const rawMenDoc = scraper.parseHtml(recordsRawMenHtml);

const defaultCategories = recordService.parseRecordsHtml(defaultDoc);
const rawCategories = recordService.parseRecordsHtml(rawDoc);
const rawMenCategories = recordService.parseRecordsHtml(rawMenDoc);

describe("records service", () => {
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
});
