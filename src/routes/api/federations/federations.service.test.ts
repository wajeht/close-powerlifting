import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { buildFederationStats } from "./federations.service";
import type { Meet } from "../../../types";

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
});
