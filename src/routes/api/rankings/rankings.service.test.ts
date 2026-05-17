import { describe, expect, it } from "vite-plus/test";

import { createContext } from "../../../context";
import { createRankingService } from "./rankings.service";

const context = createContext();
const rankingService = createRankingService(context.knex);

describe("rankings service", () => {
  describe("parseRankingsCacheKey", () => {
    it("returns null for non-rankings keys", () => {
      expect(rankingService.parseRankingsCacheKey("status")).toBeNull();
      expect(rankingService.parseRankingsCacheKey("user-johnhaack-lbs")).toBeNull();
    });

    it("parses unfiltered rankings key", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-1-100-lbs")).toEqual({
        filterPath: "",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
      });
    });

    it("parses filtered rankings key", () => {
      expect(rankingService.parseRankingsCacheKey("rankings/raw/men-1-100-lbs")).toEqual({
        filterPath: "/raw/men",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
      });
    });

    it("parses rankings key with federation", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-1-100-lbs-uspa")).toEqual({
        filterPath: "",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: "uspa",
      });
    });

    it("returns null for keys with non-numeric page or perPage", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-abc-def-lbs")).toBeNull();
    });
  });

  describe("refreshCacheKey", () => {
    it("returns false for non-rankings keys", async () => {
      expect(await rankingService.refreshCacheKey("status")).toBe(false);
    });

    it("returns true for unfiltered rankings key", async () => {
      expect(await rankingService.refreshCacheKey("rankings-1-100-lbs")).toBe(true);
    });

    it("returns true for filtered rankings key", async () => {
      expect(await rankingService.refreshCacheKey("rankings/raw/men-1-100-lbs")).toBe(true);
    });
  });
});
