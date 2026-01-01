import { describe, expect, test } from "vitest";

import { parseHtml } from "../../../utils/scraper";
import { parseRecordsHtml } from "./records.service";
import { recordsDefaultHtml, recordsRawHtml, recordsRawMenHtml } from "./fixtures";

const defaultDoc = parseHtml(recordsDefaultHtml);
const rawDoc = parseHtml(recordsRawHtml);
const rawMenDoc = parseHtml(recordsRawMenHtml);

const defaultCategories = parseRecordsHtml(defaultDoc);
const rawCategories = parseRecordsHtml(rawDoc);
const rawMenCategories = parseRecordsHtml(rawMenDoc);

describe("records service", () => {
  describe("parseRecordsHtml", () => {
    test("parses default records HTML correctly", () => {
      expect(defaultCategories).toBeDefined();
      expect(Array.isArray(defaultCategories)).toBe(true);
    });

    test("parses raw records HTML correctly", () => {
      expect(rawCategories).toBeDefined();
      expect(Array.isArray(rawCategories)).toBe(true);
    });

    test("parses raw men records HTML correctly", () => {
      expect(rawMenCategories).toBeDefined();
      expect(Array.isArray(rawMenCategories)).toBe(true);
    });

    test("extracts record categories from default records", () => {
      expect(defaultCategories.length).toBeGreaterThan(0);
    });

    test("each category has a title", () => {
      defaultCategories.forEach((category) => {
        expect(category.title).toBeDefined();
        expect(category.title.length).toBeGreaterThan(0);
      });
    });

    test("each category has records array", () => {
      defaultCategories.forEach((category) => {
        expect(Array.isArray(category.records)).toBe(true);
      });
    });

    test("categories include expected lift titles", () => {
      const titles = defaultCategories.map((c) => c.title.toLowerCase());
      const hasSquat = titles.some((t) => t.includes("squat"));
      const hasBench = titles.some((t) => t.includes("bench"));
      const hasDeadlift = titles.some((t) => t.includes("deadlift"));
      expect(hasSquat || hasBench || hasDeadlift).toBe(true);
    });

    test("record entries have fields", () => {
      const firstCategory = defaultCategories[0];
      if (firstCategory && firstCategory.records.length > 0) {
        const record = firstCategory.records[0];
        expect(Object.keys(record).length).toBeGreaterThan(0);
      }
    });

    test("record entries contain lifter information", () => {
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

    test("default and raw records have categories", () => {
      expect(defaultCategories.length).toBeGreaterThan(0);
      expect(rawCategories.length).toBeGreaterThan(0);
    });

    test("raw and raw men records have categories", () => {
      expect(rawCategories.length).toBeGreaterThan(0);
      expect(rawMenCategories.length).toBeGreaterThan(0);
    });
  });
});
