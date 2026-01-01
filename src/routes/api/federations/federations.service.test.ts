import { describe, expect, test } from "vitest";

import { config } from "../../../config";
import { parseHtml, tableToJson, calculatePagination } from "../../../utils/scraper";
import { mlistHtml, mlistUsaplHtml, mlistUsapl2024Html } from "./fixtures";

const { defaultPerPage, maxPerPage } = config.pagination;

describe("federations service", () => {
  describe("mlist HTML parsing", () => {
    test("mlist HTML parses correctly", () => {
      const doc = parseHtml(mlistHtml);
      expect(doc).toBeDefined();
    });

    test("USAPL mlist HTML parses correctly", () => {
      const doc = parseHtml(mlistUsaplHtml);
      expect(doc).toBeDefined();
    });

    test("USAPL 2024 mlist HTML parses correctly", () => {
      const doc = parseHtml(mlistUsapl2024Html);
      expect(doc).toBeDefined();
    });
  });

  describe("federation select extraction", () => {
    function extractFederations(html: string) {
      const doc = parseHtml(html);
      const select = doc.querySelector("#fedselect");
      const options = select?.querySelectorAll("option") || [];

      return Array.from(options).map((opt) => ({
        value: opt.getAttribute("value") || "",
        label: opt.textContent?.trim() || "",
      }));
    }

    test("extracts federation options from mlist", () => {
      const federations = extractFederations(mlistHtml);
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
    });

    test("federation options have value attribute", () => {
      const federations = extractFederations(mlistHtml);
      const withValue = federations.filter((f) => f.value.length > 0);
      expect(withValue.length).toBeGreaterThan(0);
    });

    test("federation options include known federations", () => {
      const federations = extractFederations(mlistHtml);
      const values = federations.map((f) => f.value);
      expect(values).toContain("usapl");
      expect(values).toContain("uspa");
      expect(values).toContain("rps");
    });
  });

  describe("year select extraction", () => {
    function extractYears(html: string) {
      const doc = parseHtml(html);
      const select = doc.querySelector("#yearselect");
      const options = select?.querySelectorAll("option") || [];

      return Array.from(options).map((opt) => opt.getAttribute("value") || "");
    }

    test("extracts year options from mlist", () => {
      const years = extractYears(mlistHtml);
      expect(Array.isArray(years)).toBe(true);
      expect(years.length).toBeGreaterThan(0);
    });

    test("year options include recent years", () => {
      const years = extractYears(mlistHtml);
      expect(years).toContain("2024");
      expect(years).toContain("2023");
    });
  });

  describe("meets table extraction", () => {
    function extractMeets(html: string) {
      const doc = parseHtml(html);
      const table = doc.querySelector("table");
      return tableToJson<Record<string, string>>(table);
    }

    test("extracts meets from mlist", () => {
      const meets = extractMeets(mlistHtml);
      expect(Array.isArray(meets)).toBe(true);
      expect(meets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL mlist", () => {
      const meets = extractMeets(mlistUsaplHtml);
      expect(Array.isArray(meets)).toBe(true);
      expect(meets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL 2024 mlist", () => {
      const meets = extractMeets(mlistUsapl2024Html);
      expect(Array.isArray(meets)).toBe(true);
      expect(meets.length).toBeGreaterThan(0);
    });

    test("meets have Fed column", () => {
      const meets = extractMeets(mlistHtml);
      if (meets.length > 0) {
        const keys = Object.keys(meets[0]);
        const hasFed = keys.some((k) => k.toLowerCase() === "fed");
        expect(hasFed).toBe(true);
      }
    });

    test("meets have Date column", () => {
      const meets = extractMeets(mlistHtml);
      if (meets.length > 0) {
        const keys = Object.keys(meets[0]);
        const hasDate = keys.some((k) => k.toLowerCase() === "date");
        expect(hasDate).toBe(true);
      }
    });

    test("meets have Location column", () => {
      const meets = extractMeets(mlistHtml);
      if (meets.length > 0) {
        const keys = Object.keys(meets[0]);
        const hasLocation = keys.some((k) => k.toLowerCase() === "location");
        expect(hasLocation).toBe(true);
      }
    });

    test("meets have Competition column", () => {
      const meets = extractMeets(mlistHtml);
      if (meets.length > 0) {
        const keys = Object.keys(meets[0]);
        const hasCompetition = keys.some((k) => k.toLowerCase() === "competition");
        expect(hasCompetition).toBe(true);
      }
    });

    test("meets have Lifters column", () => {
      const meets = extractMeets(mlistHtml);
      if (meets.length > 0) {
        const keys = Object.keys(meets[0]);
        const hasLifters = keys.some((k) => k.toLowerCase() === "lifters");
        expect(hasLifters).toBe(true);
      }
    });
  });

  describe("filtered meets comparison", () => {
    function extractMeets(html: string) {
      const doc = parseHtml(html);
      const table = doc.querySelector("table");
      return tableToJson<Record<string, string>>(table);
    }

    function getField(row: Record<string, string>, fieldName: string): string {
      // Case-insensitive key lookup
      const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
      return key ? row[key] : "";
    }

    test("USAPL filtered meets contain only USAPL federation", () => {
      const meets = extractMeets(mlistUsaplHtml);
      if (meets.length > 0) {
        const firstMeet = meets[0];
        const fed = getField(firstMeet, "Fed");
        expect(fed.toLowerCase()).toContain("usapl");
      }
    });

    test("year filtered meets have correct year in date", () => {
      const meets = extractMeets(mlistUsapl2024Html);
      if (meets.length > 0) {
        const firstMeet = meets[0];
        const date = getField(firstMeet, "Date");
        expect(date).toContain("2024");
      }
    });
  });

  describe("full mlist data extraction", () => {
    function extractMlistData(html: string) {
      const doc = parseHtml(html);

      // Federation options
      const fedSelect = doc.querySelector("#fedselect");
      const fedOptions = fedSelect?.querySelectorAll("option") || [];
      const federations = Array.from(fedOptions).map((opt) => ({
        value: opt.getAttribute("value") || "",
        label: opt.textContent?.trim() || "",
      }));

      // Year options
      const yearSelect = doc.querySelector("#yearselect");
      const yearOptions = yearSelect?.querySelectorAll("option") || [];
      const years = Array.from(yearOptions).map((opt) => opt.getAttribute("value") || "");

      // Meets table
      const table = doc.querySelector("table");
      const meets = tableToJson<Record<string, string>>(table);

      return { federations, years, meets };
    }

    test("extracts complete mlist data", () => {
      const mlistData = extractMlistData(mlistHtml);

      expect(Array.isArray(mlistData.federations)).toBe(true);
      expect(mlistData.federations.length).toBeGreaterThan(0);
      expect(Array.isArray(mlistData.years)).toBe(true);
      expect(mlistData.years.length).toBeGreaterThan(0);
      expect(Array.isArray(mlistData.meets)).toBe(true);
      expect(mlistData.meets.length).toBeGreaterThan(0);
    });

    test("filtered mlist has same structure as default", () => {
      const defaultData = extractMlistData(mlistHtml);
      const usaplData = extractMlistData(mlistUsaplHtml);

      expect(usaplData.federations.length).toBeGreaterThan(0);
      expect(usaplData.years.length).toBeGreaterThan(0);
      expect(usaplData.meets.length).toBeGreaterThan(0);

      // Structure should be the same
      if (defaultData.meets.length > 0 && usaplData.meets.length > 0) {
        const defaultKeys = Object.keys(defaultData.meets[0]);
        const usaplKeys = Object.keys(usaplData.meets[0]);
        expect(defaultKeys.length).toBe(usaplKeys.length);
      }
    });
  });

  describe("pagination", () => {
    function extractMeets(html: string) {
      const doc = parseHtml(html);
      const table = doc.querySelector("table");
      return tableToJson<Record<string, string>>(table);
    }

    test("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    test("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    test("calculatePagination works with federations data", () => {
      const meets = extractMeets(mlistHtml);
      const totalItems = meets.length;
      const pagination = calculatePagination(totalItems, 1, defaultPerPage);

      expect(pagination.items).toBe(totalItems);
      expect(pagination.per_page).toBe(defaultPerPage);
      expect(pagination.current_page).toBe(1);
      expect(pagination.first_page).toBe(1);
    });

    test("pagination correctly slices data", () => {
      const meets = extractMeets(mlistHtml);
      const perPage = 10;
      const currentPage = 1;

      const startIndex = (currentPage - 1) * perPage;
      const endIndex = startIndex + perPage;
      const paginatedData = meets.slice(startIndex, endIndex);

      expect(paginatedData.length).toBeLessThanOrEqual(perPage);
    });

    test("pagination page 2 returns different data", () => {
      const meets = extractMeets(mlistHtml);
      const perPage = 10;

      const page1Start = 0;
      const page1End = perPage;
      const page2Start = perPage;
      const page2End = perPage * 2;

      const page1Data = meets.slice(page1Start, page1End);
      const page2Data = meets.slice(page2Start, page2End);

      if (meets.length > perPage) {
        expect(page1Data).not.toEqual(page2Data);
      }
    });
  });
});
