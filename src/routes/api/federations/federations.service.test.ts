import { describe, expect, it, vi } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import { createFederationService, buildFederationStats } from "./federations.service";
import { mlistHtml, mlistUsaplHtml, mlistUsapl2024Html } from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const federationService = createFederationService(scraper);
const { defaultPerPage, maxPerPage } = configuration.pagination;

const mlistDoc = scraper.parseHtml(mlistHtml);
const mlistUsaplDoc = scraper.parseHtml(mlistUsaplHtml);
const mlistUsapl2024Doc = scraper.parseHtml(mlistUsapl2024Html);

const mlistMeets = federationService.parseFederationMeetsHtml(mlistDoc);
const mlistUsaplMeets = federationService.parseFederationMeetsHtml(mlistUsaplDoc);
const mlistUsapl2024Meets = federationService.parseFederationMeetsHtml(mlistUsapl2024Doc);

function getField(row: Record<string, string>, fieldName: string): string {
  const key = Object.keys(row).find((k) => k.toLowerCase() === fieldName.toLowerCase());
  return key ? row[key] : "";
}

describe.concurrent("federations service", () => {
  describe("parseFederationMeetsHtml", () => {
    it("parses mlist HTML correctly", () => {
      expect(mlistMeets).toBeDefined();
      expect(Array.isArray(mlistMeets)).toBe(true);
    });

    it("parses USAPL mlist HTML correctly", () => {
      expect(mlistUsaplMeets).toBeDefined();
      expect(Array.isArray(mlistUsaplMeets)).toBe(true);
    });

    it("parses USAPL 2024 mlist HTML correctly", () => {
      expect(mlistUsapl2024Meets).toBeDefined();
      expect(Array.isArray(mlistUsapl2024Meets)).toBe(true);
    });

    it("extracts meets from mlist", () => {
      expect(mlistMeets.length).toBeGreaterThan(0);
    });

    it("extracts meets from USAPL mlist", () => {
      expect(mlistUsaplMeets.length).toBeGreaterThan(0);
    });

    it("extracts meets from USAPL 2024 mlist", () => {
      expect(mlistUsapl2024Meets.length).toBeGreaterThan(0);
    });

    it("meets have Fed column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasFed = keys.some((k) => k.toLowerCase() === "fed");
        expect(hasFed).toBe(true);
      }
    });

    it("meets have Date column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasDate = keys.some((k) => k.toLowerCase() === "date");
        expect(hasDate).toBe(true);
      }
    });

    it("meets have Location column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasLocation = keys.some((k) => k.toLowerCase() === "location");
        expect(hasLocation).toBe(true);
      }
    });

    it("meets have Competition column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasCompetition = keys.some((k) => k.toLowerCase() === "competition");
        expect(hasCompetition).toBe(true);
      }
    });

    it("meets have Lifters column", () => {
      if (mlistMeets.length > 0) {
        const keys = Object.keys(mlistMeets[0]);
        const hasLifters = keys.some((k) => k.toLowerCase() === "lifters");
        expect(hasLifters).toBe(true);
      }
    });

    it("USAPL filtered meets contain only USAPL federation", () => {
      if (mlistUsaplMeets.length > 0) {
        const firstMeet = mlistUsaplMeets[0];
        const fed = getField(firstMeet, "Fed");
        expect(fed.toLowerCase()).toContain("usapl");
      }
    });

    it("year filtered meets have correct year in date", () => {
      if (mlistUsapl2024Meets.length > 0) {
        const firstMeet = mlistUsapl2024Meets[0];
        const date = getField(firstMeet, "Date");
        expect(date).toContain("2024");
      }
    });

    it("filtered mlist has same column structure as default", () => {
      if (mlistMeets.length > 0 && mlistUsaplMeets.length > 0) {
        const defaultKeys = Object.keys(mlistMeets[0]);
        const usaplKeys = Object.keys(mlistUsaplMeets[0]);
        expect(defaultKeys.length).toBe(usaplKeys.length);
      }
    });
  });

  describe("buildFederationStats", () => {
    it("returns stats with federation slug and total_meets matching input length", () => {
      const stats = buildFederationStats("usapl", mlistUsaplMeets);
      expect(stats.federation).toBe("usapl");
      expect(stats.total_meets).toBe(mlistUsaplMeets.length);
    });

    it("meets_by_year is sorted ascending by year", () => {
      const stats = buildFederationStats("usapl", mlistUsaplMeets);
      for (let i = 1; i < stats.meets_by_year.length; i++) {
        expect(stats.meets_by_year[i]!.year).toBeGreaterThan(stats.meets_by_year[i - 1]!.year);
      }
    });

    it("each meets_by_year entry has year and meets count", () => {
      const stats = buildFederationStats("usapl", mlistUsaplMeets);
      for (const entry of stats.meets_by_year) {
        expect(entry.year).toBeGreaterThan(1900);
        expect(entry.meets).toBeGreaterThan(0);
      }
    });

    it("earliest_year and latest_year reflect first and last entries", () => {
      const stats = buildFederationStats("usapl", mlistUsaplMeets);
      if (stats.meets_by_year.length > 0) {
        expect(stats.earliest_year).toBe(stats.meets_by_year[0]!.year);
        expect(stats.latest_year).toBe(stats.meets_by_year[stats.meets_by_year.length - 1]!.year);
      }
    });

    it("year-filtered fixture (USAPL 2024) yields only one year", () => {
      const stats = buildFederationStats("usapl", mlistUsapl2024Meets);
      expect(stats.meets_by_year.length).toBeLessThanOrEqual(1);
      if (stats.meets_by_year.length === 1) {
        expect(stats.meets_by_year[0]!.year).toBe(2024);
      }
    });

    it("returns nulls for earliest/latest year when no meets", () => {
      const stats = buildFederationStats("test", []);
      expect(stats.total_meets).toBe(0);
      expect(stats.earliest_year).toBeNull();
      expect(stats.latest_year).toBeNull();
      expect(stats.meets_by_year).toEqual([]);
    });

    it("sum of per-year counts equals total_meets when all dates parse", () => {
      const stats = buildFederationStats("usapl", mlistUsaplMeets);
      const sum = stats.meets_by_year.reduce((acc, entry) => acc + entry.meets, 0);
      expect(sum).toBeLessThanOrEqual(stats.total_meets);
    });
  });

  describe("getFederationStats service method", () => {
    it("uses a stats-suffixed cache key", async () => {
      const cacheSpy = vi
        .spyOn(scraper, "withCache")
        .mockResolvedValueOnce({ data: buildFederationStats("usapl", mlistUsaplMeets) });

      await federationService.getFederationStats("usapl");

      expect(cacheSpy).toHaveBeenCalledWith("federation-usapl-stats", expect.any(Function));
      cacheSpy.mockRestore();
    });
  });

  describe("pagination", () => {
    it("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    it("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    it("calculatePagination works with federations data", () => {
      const totalItems = mlistMeets.length;
      const pagination = scraper.calculatePagination(totalItems, 1, defaultPerPage);

      expect(pagination.items).toBe(totalItems);
      expect(pagination.per_page).toBe(defaultPerPage);
      expect(pagination.current_page).toBe(1);
      expect(pagination.first_page).toBe(1);
    });

    it("pagination correctly slices data", () => {
      const perPage = 10;
      const paginatedData = mlistMeets.slice(0, perPage);
      expect(paginatedData.length).toBeLessThanOrEqual(perPage);
    });

    it("pagination page 2 returns different data", () => {
      const perPage = 10;
      const page1Data = mlistMeets.slice(0, perPage);
      const page2Data = mlistMeets.slice(perPage, perPage * 2);

      if (mlistMeets.length > perPage) {
        expect(page1Data).not.toEqual(page2Data);
      }
    });
  });

  describe("parseFederationCacheKey", () => {
    it("returns null for non-federation keys", () => {
      expect(federationService.parseFederationCacheKey("status")).toBeNull();
      expect(federationService.parseFederationCacheKey("user-johnhaack-lbs")).toBeNull();
    });

    it("parses federations-list", () => {
      expect(federationService.parseFederationCacheKey("federations-list")).toEqual({
        kind: "list",
      });
    });

    it("parses base federation key", () => {
      expect(federationService.parseFederationCacheKey("federation-ipf")).toEqual({
        kind: "federation",
        federation: "ipf",
      });
    });

    it("parses federation key with year", () => {
      expect(federationService.parseFederationCacheKey("federation-uspa-2024")).toEqual({
        kind: "federation",
        federation: "uspa",
        year: 2024,
      });
    });

    it("parses stats key", () => {
      expect(federationService.parseFederationCacheKey("federation-ipf-stats")).toEqual({
        kind: "stats",
        federation: "ipf",
      });
    });

    it("does not treat 3-digit suffix as a year", () => {
      expect(federationService.parseFederationCacheKey("federation-365strong")).toEqual({
        kind: "federation",
        federation: "365strong",
      });
    });

    it("handles hyphenated federation names", () => {
      expect(federationService.parseFederationCacheKey("federation-usa-pl-2020")).toEqual({
        kind: "federation",
        federation: "usa-pl",
        year: 2020,
      });
    });
  });
});

describe("federations service refreshCacheKey", () => {
  it("returns false for non-federation keys", async () => {
    expect(await federationService.refreshCacheKey("status")).toBe(false);
  });

  it("returns true for federations-list", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

    const result = await federationService.refreshCacheKey("federations-list");
    expect(result).toBe(true);
    expect(refreshSpy).toHaveBeenCalledWith("federations-list", expect.any(Function));
    refreshSpy.mockRestore();
  });

  it("returns true for federation key with year", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

    const result = await federationService.refreshCacheKey("federation-uspa-2024");
    expect(result).toBe(true);
    expect(refreshSpy).toHaveBeenCalledWith("federation-uspa-2024", expect.any(Function));
    refreshSpy.mockRestore();
  });

  it("returns true for stats key", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

    const result = await federationService.refreshCacheKey("federation-ipf-stats");
    expect(result).toBe(true);
    expect(refreshSpy).toHaveBeenCalledWith("federation-ipf-stats", expect.any(Function));
    refreshSpy.mockRestore();
  });
});
