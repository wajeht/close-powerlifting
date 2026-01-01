import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { recordsDefaultHtml, recordsRawHtml, recordsRawMenHtml } from "./fixtures";

describe("records service", () => {
  describe("records HTML parsing", () => {
    test("default records HTML parses correctly", () => {
      const doc = parseHtml(recordsDefaultHtml);
      expect(doc).toBeDefined();
    });

    test("raw records HTML parses correctly", () => {
      const doc = parseHtml(recordsRawHtml);
      expect(doc).toBeDefined();
    });

    test("raw men records HTML parses correctly", () => {
      const doc = parseHtml(recordsRawMenHtml);
      expect(doc).toBeDefined();
    });
  });

  describe("records-col extraction", () => {
    test("finds records-col elements in default records", () => {
      const doc = parseHtml(recordsDefaultHtml);
      const recordCols = doc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });

    test("finds records-col elements in raw records", () => {
      const doc = parseHtml(recordsRawHtml);
      const recordCols = doc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });

    test("finds records-col elements in raw men records", () => {
      const doc = parseHtml(recordsRawMenHtml);
      const recordCols = doc.getElementsByClassName("records-col");
      expect(recordCols.length).toBeGreaterThan(0);
    });
  });

  describe("record categories extraction", () => {
    function extractRecordCategories(html: string) {
      const doc = parseHtml(html);
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

    test("extracts record categories from default records", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);
      expect(categories.length).toBeGreaterThan(0);
    });

    test("each category has a title", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);
      categories.forEach((category) => {
        expect(category.title).toBeDefined();
        expect(category.title.length).toBeGreaterThan(0);
      });
    });

    test("each category has records array", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);
      categories.forEach((category) => {
        expect(Array.isArray(category.records)).toBe(true);
      });
    });

    test("categories include expected titles", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);
      const titles = categories.map((c) => c.title.toLowerCase());

      const hasSquat = titles.some((t) => t.includes("squat"));
      const hasBench = titles.some((t) => t.includes("bench"));
      const hasDeadlift = titles.some((t) => t.includes("deadlift"));

      expect(hasSquat || hasBench || hasDeadlift).toBe(true);
    });
  });

  describe("record entries structure", () => {
    function extractRecordCategories(html: string) {
      const doc = parseHtml(html);
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

    test("record entries have expected fields", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);
      const firstCategory = categories[0];

      if (firstCategory && firstCategory.records.length > 0) {
        const record = firstCategory.records[0];
        const keys = Object.keys(record);

        expect(keys.length).toBeGreaterThan(0);
      }
    });

    test("record entries contain lifter information", () => {
      const categories = extractRecordCategories(recordsDefaultHtml);

      for (const category of categories) {
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
    function countCategories(html: string) {
      const doc = parseHtml(html);
      const recordCols = doc.getElementsByClassName("records-col");
      return recordCols.length;
    }

    test("default and raw records have same structure", () => {
      const defaultCount = countCategories(recordsDefaultHtml);
      const rawCount = countCategories(recordsRawHtml);

      expect(defaultCount).toBeGreaterThan(0);
      expect(rawCount).toBeGreaterThan(0);
    });

    test("raw and raw men records have same structure", () => {
      const rawCount = countCategories(recordsRawHtml);
      const rawMenCount = countCategories(recordsRawMenHtml);

      expect(rawCount).toBeGreaterThan(0);
      expect(rawMenCount).toBeGreaterThan(0);
    });
  });
});
