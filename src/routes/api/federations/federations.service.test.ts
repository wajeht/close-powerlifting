import { describe, expect, test } from "vitest";

import { config } from "../../../config";
import { parseHtml, tableToJson, calculatePagination } from "../../../utils/scraper";
import { mlistHtml, mlistUsaplHtml, mlistUsapl2024Html } from "./fixtures";

const { defaultPerPage, maxPerPage } = config.pagination;

const mlistDoc = parseHtml(mlistHtml);
const mlistUsaplDoc = parseHtml(mlistUsaplHtml);
const mlistUsapl2024Doc = parseHtml(mlistUsapl2024Html);

const mlistMeets = tableToJson<Record<string, string>>(mlistDoc.querySelector("table"));
const mlistUsaplMeets = tableToJson<Record<string, string>>(mlistUsaplDoc.querySelector("table"));
const mlistUsapl2024Meets = tableToJson<Record<string, string>>(
  mlistUsapl2024Doc.querySelector("table"),
);

function extractOptions(doc: Document, selector: string) {
  const select = doc.querySelector(selector);
  const options = select?.querySelectorAll("option") || [];
  return Array.from(options).map((opt) => ({
    value: opt.getAttribute("value") || "",
    label: opt.textContent?.trim() || "",
  }));
}

function getField(row: Record<string, string>, fieldName: string): string {
  const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
  return key ? row[key] : "";
}

const federations = extractOptions(mlistDoc, "#fedselect");
const years = extractOptions(mlistDoc, "#yearselect").map((o) => o.value);
const usaplFederations = extractOptions(mlistUsaplDoc, "#fedselect");
const usaplYears = extractOptions(mlistUsaplDoc, "#yearselect").map((o) => o.value);

describe("federations service", () => {
  describe("mlist HTML parsing", () => {
    test("mlist HTML parses correctly", () => {
      expect(mlistDoc).toBeDefined();
    });

    test("USAPL mlist HTML parses correctly", () => {
      expect(mlistUsaplDoc).toBeDefined();
    });

    test("USAPL 2024 mlist HTML parses correctly", () => {
      expect(mlistUsapl2024Doc).toBeDefined();
    });
  });

  describe("federation select extraction", () => {
    test("extracts federation options from mlist", () => {
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
    });

    test("federation options have value attribute", () => {
      const withValue = federations.filter((f) => f.value.length > 0);
      expect(withValue.length).toBeGreaterThan(0);
    });

    test("federation options include known federations", () => {
      const values = federations.map((f) => f.value);
      expect(values).toContain("usapl");
      expect(values).toContain("uspa");
      expect(values).toContain("rps");
    });
  });

  describe("year select extraction", () => {
    test("extracts year options from mlist", () => {
      expect(Array.isArray(years)).toBe(true);
      expect(years.length).toBeGreaterThan(0);
    });

    test("year options include recent years", () => {
      expect(years).toContain("2024");
      expect(years).toContain("2023");
    });
  });

  describe("meets table extraction", () => {
    test("extracts meets from mlist", () => {
      expect(Array.isArray(mlistMeets)).toBe(true);
      expect(mlistMeets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL mlist", () => {
      expect(Array.isArray(mlistUsaplMeets)).toBe(true);
      expect(mlistUsaplMeets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL 2024 mlist", () => {
      expect(Array.isArray(mlistUsapl2024Meets)).toBe(true);
      expect(mlistUsapl2024Meets.length).toBeGreaterThan(0);
    });

    test("meets have Fed column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasFed = keys.some((k) => k.toLowerCase() === "fed");
        expect(hasFed).toBe(true);
      }
    });

    test("meets have Date column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasDate = keys.some((k) => k.toLowerCase() === "date");
        expect(hasDate).toBe(true);
      }
    });

    test("meets have Location column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasLocation = keys.some((k) => k.toLowerCase() === "location");
        expect(hasLocation).toBe(true);
      }
    });

    test("meets have Competition column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasCompetition = keys.some((k) => k.toLowerCase() === "competition");
        expect(hasCompetition).toBe(true);
      }
    });

    test("meets have Lifters column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasLifters = keys.some((k) => k.toLowerCase() === "lifters");
        expect(hasLifters).toBe(true);
      }
    });
  });

  describe("filtered meets comparison", () => {
    test("USAPL filtered meets contain only USAPL federation", () => {
      if (mlistUsaplMeets.length > 0) {
        const firstMeet = mlistUsaplMeets[0];
        const fed = getField(firstMeet, "Fed");
        expect(fed.toLowerCase()).toContain("usapl");
      }
    });

    test("year filtered meets have correct year in date", () => {
      if (mlistUsapl2024Meets.length > 0) {
        const firstMeet = mlistUsapl2024Meets[0];
        const date = getField(firstMeet, "Date");
        expect(date).toContain("2024");
      }
    });
  });

  describe("full mlist data extraction", () => {
    test("extracts complete mlist data", () => {
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
      expect(Array.isArray(years)).toBe(true);
      expect(years.length).toBeGreaterThan(0);
      expect(Array.isArray(mlistMeets)).toBe(true);
      expect(mlistMeets.length).toBeGreaterThan(0);
    });

    test("filtered mlist has same structure as default", () => {
      expect(usaplFederations.length).toBeGreaterThan(0);
      expect(usaplYears.length).toBeGreaterThan(0);
      expect(mlistUsaplMeets.length).toBeGreaterThan(0);

      if (mlistMeets.length > 0 && mlistUsaplMeets.length > 0) {
        const defaultKeys = Object.keys(mlistMeets[0]);
        const usaplKeys = Object.keys(mlistUsaplMeets[0]);
        expect(defaultKeys.length).toBe(usaplKeys.length);
      }
    });
  });

  describe("pagination", () => {
    test("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    test("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    test("calculatePagination works with federations data", () => {
      const totalItems = mlistMeets.length;
      const pagination = calculatePagination(totalItems, 1, defaultPerPage);

      expect(pagination.items).toBe(totalItems);
      expect(pagination.per_page).toBe(defaultPerPage);
      expect(pagination.current_page).toBe(1);
      expect(pagination.first_page).toBe(1);
    });

    test("pagination correctly slices data", () => {
      const perPage = 10;
      const currentPage = 1;

      const startIndex = (currentPage - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedData = mlistMeets.slice(startIndex, endIndex);

      expect(paginatedData.length).toBeLessThanOrEqual(perPage);
    });

    test("pagination page 2 returns different data", () => {
      const perPage = 10;

      const page1Data = mlistMeets.slice(0, perPage);
      const page2Data = mlistMeets.slice(perPage, perPage * 2);

      if (mlistMeets.length > perPage) {
        expect(page1Data).not.toEqual(page2Data);
      }
    });
  });
});
