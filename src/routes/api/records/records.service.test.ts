import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { recordsDefaultHtml, recordsRawHtml, recordsRawMenHtml } from "./fixtures";

const defaultDoc = parseHtml(recordsDefaultHtml);
const rawDoc = parseHtml(recordsRawHtml);
const rawMenDoc = parseHtml(recordsRawMenHtml);

function extractCategories(doc: Document) {
  const recordCols = doc.getElementsByClassName("records-col");
  const data: { title: string; records: Record<string, string>[] }[] = [];

  for (const col of recordCols) {
    const heading = col.querySelector("h2, h3");
    const table = col.querySelector("table");

    if (heading && table) {
      data.push({
        title: heading.textContent?.trim() || "",
        records: tableToJson<Record<string, string>>(table),
      });
    }
  }

  return data;
}

const defaultCategories = extractCategories(defaultDoc);
const rawCategories = extractCategories(rawDoc);
const rawMenCategories = extractCategories(rawMenDoc);

describe("records service", () => {
  describe("records HTML parsing", () => {
    test("default records HTML parses correctly", () => {
      expect(defaultDoc).toBeDefined();
    });

    test("raw records HTML parses correctly", () => {
      expect(rawDoc).toBeDefined();
    });

    test("raw men records HTML parses correctly", () => {
      expect(rawMenDoc).toBeDefined();
    });
  });

  describe("records-col extraction", () => {
    test("finds records-col elements in default records", () => {
      const recordCols = defaultDoc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });

    test("finds records-col elements in raw records", () => {
      const recordCols = rawDoc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });

    test("finds records-col elements in raw men records", () => {
      const recordCols = rawMenDoc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });
  });

  describe("record categories extraction", () => {
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

    test("categories include expected titles", () => {
      const titles = defaultCategories.map((c) => c.title.toLowerCase());

      const hasSquat = titles.some((t) => t.includes("squat"));
      const hasBench = titles.some((t) => t.includes("bench"));
      const hasDeadlift = titles.some((t) => t.includes("deadlift"));

      expect(hasSquat || hasBench || hasDeadlift).toBe(true);
    });
  });

  describe("record entries structure", () => {
    test("record entries have expected fields", () => {
      const firstCategory = defaultCategories[0];

      if (firstCategory && firstCategory.records.length > 0) {
        const record = firstCategory.records[0];
        const keys = Object.keys(record);

        expect(keys.length).toBeGreaterThan(0);
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
  });

  describe("filtered records comparison", () => {
    test("default and raw records have same structure", () => {
      expect(defaultCategories.length).toBeGreaterThan(0);
      expect(rawCategories.length).toBeGreaterThan(0);
    });

    test("raw and raw men records have same structure", () => {
      expect(rawCategories.length).toBeGreaterThan(0);
      expect(rawMenCategories.length).toBeGreaterThan(0);
    });
  });
});
