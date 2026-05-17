import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import { createFederationService, buildFederationStats } from "./federations.service";
import type { Meet } from "../../../types";

const context = createContext();
const federationService = createFederationService(context.knex);
const { defaultPerPage, maxPerPage } = configuration.pagination;

const sampleMeets: Meet[] = [
  { federation: "USAPL", date: "2024-05-12", meetname: "Raw Nationals", location: "USA-TX" },
  { federation: "USAPL", date: "2024-08-20", meetname: "Pro", location: "USA-CA" },
  { federation: "USAPL", date: "2023-09-15", meetname: "Open", location: "USA-FL" },
  { federation: "USAPL", date: "2022-01-01", meetname: "Winter Open", location: "USA-NY" },
];

describe.concurrent("federations service", () => {
  describe("buildFederationStats", () => {
    it("returns stats with federation slug and total_meets matching input length", () => {
      const stats = buildFederationStats("usapl", sampleMeets);
      expect(stats.federation).toBe("usapl");
      expect(stats.total_meets).toBe(sampleMeets.length);
    });

    it("meets_by_year is sorted ascending by year", () => {
      const stats = buildFederationStats("usapl", sampleMeets);
      for (let i = 1; i < stats.meets_by_year.length; i++) {
        expect(stats.meets_by_year[i]!.year).toBeGreaterThan(stats.meets_by_year[i - 1]!.year);
      }
    });

    it("each meets_by_year entry has year and meets count", () => {
      const stats = buildFederationStats("usapl", sampleMeets);
      for (const entry of stats.meets_by_year) {
        expect(entry.year).toBeGreaterThan(1900);
        expect(entry.meets).toBeGreaterThan(0);
      }
    });

    it("earliest_year and latest_year reflect first and last entries", () => {
      const stats = buildFederationStats("usapl", sampleMeets);
      expect(stats.earliest_year).toBe(2022);
      expect(stats.latest_year).toBe(2024);
    });

    it("returns nulls for earliest/latest year when no meets", () => {
      const stats = buildFederationStats("test", []);
      expect(stats.total_meets).toBe(0);
      expect(stats.earliest_year).toBeNull();
      expect(stats.latest_year).toBeNull();
      expect(stats.meets_by_year).toEqual([]);
    });

    it("sum of per-year counts equals total_meets when all dates parse", () => {
      const stats = buildFederationStats("usapl", sampleMeets);
      const sum = stats.meets_by_year.reduce((acc, entry) => acc + entry.meets, 0);
      expect(sum).toBe(stats.total_meets);
    });
  });

  describe("pagination defaults", () => {
    it("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    it("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
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

  it("returns true for federations-list without re-scraping (lifts now)", async () => {
    const result = await federationService.refreshCacheKey("federations-list");
    expect(result).toBe(true);
  });

  it("returns true for federation key with year", async () => {
    const result = await federationService.refreshCacheKey("federation-uspa-2024");
    expect(result).toBe(true);
  });

  it("returns true for stats key", async () => {
    const result = await federationService.refreshCacheKey("federation-ipf-stats");
    expect(result).toBe(true);
  });
});
