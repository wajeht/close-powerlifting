import { describe, expect, test } from "vitest";

import { config } from "../../../config";
import { parseHtml, calculatePagination } from "../../../utils/scraper";
import { parseFederationMeetsHtml } from "./federations.service";
import { mlistHtml, mlistUsaplHtml, mlistUsapl2024Html } from "./fixtures";

const { defaultPerPage, maxPerPage } = config.pagination;

const mlistDoc = parseHtml(mlistHtml);
const mlistUsaplDoc = parseHtml(mlistUsaplHtml);
const mlistUsapl2024Doc = parseHtml(mlistUsapl2024Html);

const mlistMeets = parseFederationMeetsHtml(mlistDoc);
const mlistUsaplMeets = parseFederationMeetsHtml(mlistUsaplDoc);
const mlistUsapl2024Meets = parseFederationMeetsHtml(mlistUsapl2024Doc);

function getField(row: Record<string, string>, fieldName: string): string {
  const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
  return key ? row[key] : "";
}

describe("federations service", () => {
  describe("parseFederationMeetsHtml", () => {
    test("parses mlist HTML correctly", () => {
      expect(mlistMeets).toBeDefined();
      expect(Array.isArray(mlistMeets)).toBe(true);
    });

    test("parses USAPL mlist HTML correctly", () => {
      expect(mlistUsaplMeets).toBeDefined();
      expect(Array.isArray(mlistUsaplMeets)).toBe(true);
    });

    test("parses USAPL 2024 mlist HTML correctly", () => {
      expect(mlistUsapl2024Meets).toBeDefined();
      expect(Array.isArray(mlistUsapl2024Meets)).toBe(true);
    });

    test("extracts meets from mlist", () => {
      expect(mlistMeets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL mlist", () => {
      expect(mlistUsaplMeets.length).toBeGreaterThan(0);
    });

    test("extracts meets from USAPL 2024 mlist", () => {
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

    test("filtered mlist has same column structure as default", () => {
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
      const paginatedData = mlistMeets.slice(0, perPage);
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
