import { describe, expect, it, vi } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import { createRankingService } from "./rankings.service";

const context = createContext();
const scraper = context.scraper;
const rankingService = createRankingService(scraper);
import {
  rankingsDefault,
  rankingsRawMen,
  rankingsRawWomen75,
  rankingsFullFilter,
} from "./fixtures";

const { defaultPerPage, maxPerPage } = configuration.pagination;

describe.concurrent("rankings service", () => {
  describe("rankings JSON structure", () => {
    it("default rankings has expected structure", () => {
      expect(rankingsDefault).toHaveProperty("total_length");
      expect(rankingsDefault).toHaveProperty("rows");
      expect(Array.isArray(rankingsDefault.rows)).toBe(true);
      expect(rankingsDefault.rows.length).toBeGreaterThan(0);
    });

    it("raw men rankings has expected structure", () => {
      expect(rankingsRawMen).toHaveProperty("total_length");
      expect(rankingsRawMen).toHaveProperty("rows");
      expect(Array.isArray(rankingsRawMen.rows)).toBe(true);
    });

    it("raw women 75kg rankings has expected structure", () => {
      expect(rankingsRawWomen75).toHaveProperty("total_length");
      expect(rankingsRawWomen75).toHaveProperty("rows");
      expect(Array.isArray(rankingsRawWomen75.rows)).toBe(true);
    });

    it("full filter rankings has expected structure", () => {
      expect(rankingsFullFilter).toHaveProperty("total_length");
      expect(rankingsFullFilter).toHaveProperty("rows");
      expect(Array.isArray(rankingsFullFilter.rows)).toBe(true);
    });
  });

  describe("rankings row structure", () => {
    it("each row has expected number of fields", () => {
      const row = rankingsDefault.rows[0];
      expect(Array.isArray(row)).toBe(true);
      expect(row.length).toBeGreaterThanOrEqual(24);
    });

    it("row contains expected data types", () => {
      const row = rankingsDefault.rows[0];
      expect(typeof row[0]).toBe("number"); // id
      expect(typeof row[1]).toBe("number"); // rank
      expect(typeof row[2]).toBe("string"); // full_name
      expect(typeof row[3]).toBe("string"); // username
    });

    it("row index mapping is correct", () => {
      const row = rankingsDefault.rows[0];
      const id = row[0];
      const rank = row[1];
      const fullName = row[2];
      const username = row[3];

      expect(typeof id).toBe("number");
      expect(typeof rank).toBe("number");
      expect(typeof fullName).toBe("string");
      expect(typeof username).toBe("string");
      expect(fullName.length).toBeGreaterThan(0);
    });
  });

  describe("transformRankingRow mapping", () => {
    function transformRankingRow(row: (string | number)[]) {
      const username = String(row[3] || "");
      const meetCode = String(row[12] || "");
      const instagram = String(row[4] || "");

      return {
        id: Number(row[0]) || 0,
        rank: Number(row[1]) || 0,
        full_name: String(row[2] || ""),
        username,
        user_profile: `/api/users/${username}`,
        instagram,
        instagram_url: instagram ? `https://www.instagram.com/${instagram}` : "",
        username_color: String(row[5] || ""),
        country: String(row[6] || ""),
        location: String(row[7] || ""),
        fed: String(row[8] || ""),
        federation_url: meetCode ? `/api/federations/${meetCode.split("/")[0]}` : "",
        date: String(row[9] || ""),
        country_two: String(row[10] || ""),
        state: String(row[11] || ""),
        meet_code: meetCode,
        meet_url: meetCode ? `/api/meets/${meetCode}` : "",
        sex: String(row[13] || ""),
        equip: String(row[14] || ""),
        age: parseInt(String(row[15]), 10) || 0,
        open: String(row[16] || ""),
        body_weight: parseFloat(String(row[17])) || 0,
        weight_class: parseFloat(String(row[18])) || 0,
        squat: parseFloat(String(row[19])) || 0,
        bench: parseFloat(String(row[20])) || 0,
        deadlift: parseFloat(String(row[21])) || 0,
        total: parseFloat(String(row[22])) || 0,
        dots: parseFloat(String(row[23])) || 0,
      };
    }

    it("transforms row to RankingRow object", () => {
      const row = rankingsDefault.rows[0];
      const transformed = transformRankingRow(row);

      expect(transformed).toHaveProperty("id");
      expect(transformed).toHaveProperty("rank");
      expect(transformed).toHaveProperty("full_name");
      expect(transformed).toHaveProperty("username");
      expect(transformed).toHaveProperty("user_profile");
      expect(transformed).toHaveProperty("instagram_url");
      expect(transformed).toHaveProperty("fed");
      expect(transformed).toHaveProperty("meet_code");
      expect(transformed).toHaveProperty("sex");
      expect(transformed).toHaveProperty("equip");
      expect(transformed).toHaveProperty("body_weight");
      expect(transformed).toHaveProperty("squat");
      expect(transformed).toHaveProperty("bench");
      expect(transformed).toHaveProperty("deadlift");
      expect(transformed).toHaveProperty("total");
      expect(transformed).toHaveProperty("dots");
    });

    it("generates correct user_profile URL", () => {
      const row = rankingsDefault.rows[0];
      const transformed = transformRankingRow(row);

      expect(transformed.user_profile).toBe(`/api/users/${transformed.username}`);
    });

    it("generates correct instagram_url when instagram exists", () => {
      const row = rankingsDefault.rows[0];
      const transformed = transformRankingRow(row);

      if (transformed.instagram) {
        expect(transformed.instagram_url).toBe(
          `https://www.instagram.com/${transformed.instagram}`,
        );
      } else {
        expect(transformed.instagram_url).toBe("");
      }
    });

    it("generates correct federation_url from meet_code", () => {
      const row = rankingsDefault.rows[0];
      const transformed = transformRankingRow(row);

      if (transformed.meet_code) {
        const fedCode = transformed.meet_code.split("/")[0];
        expect(transformed.federation_url).toBe(`/api/federations/${fedCode}`);
      }
    });

    it("numeric fields are properly parsed", () => {
      const row = rankingsDefault.rows[0];
      const transformed = transformRankingRow(row);

      expect(typeof transformed.id).toBe("number");
      expect(typeof transformed.rank).toBe("number");
      expect(typeof transformed.age).toBe("number");
      expect(typeof transformed.body_weight).toBe("number");
      expect(typeof transformed.squat).toBe("number");
      expect(typeof transformed.bench).toBe("number");
      expect(typeof transformed.deadlift).toBe("number");
      expect(typeof transformed.total).toBe("number");
      expect(typeof transformed.dots).toBe("number");
    });
  });

  describe("total_length", () => {
    it("total_length is a positive number", () => {
      expect(rankingsDefault.total_length).toBeGreaterThan(0);
    });

    it("filtered rankings have different total_length", () => {
      expect(rankingsRawMen.total_length).not.toBe(rankingsDefault.total_length);
    });
  });

  describe("pagination", () => {
    it("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    it("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    it("calculatePagination returns correct structure for rankings data", () => {
      const totalItems = rankingsDefault.total_length;
      const pagination = scraper.calculatePagination(totalItems, 1, defaultPerPage);

      expect(pagination).toHaveProperty("items");
      expect(pagination).toHaveProperty("pages");
      expect(pagination).toHaveProperty("per_page");
      expect(pagination).toHaveProperty("current_page");
      expect(pagination).toHaveProperty("last_page");
      expect(pagination).toHaveProperty("first_page");
      expect(pagination).toHaveProperty("from");
      expect(pagination).toHaveProperty("to");
    });

    it("calculatePagination calculates correct values", () => {
      const totalItems = rankingsDefault.total_length;
      const pagination = scraper.calculatePagination(totalItems, 1, defaultPerPage);

      expect(pagination.items).toBe(totalItems);
      expect(pagination.per_page).toBe(defaultPerPage);
      expect(pagination.current_page).toBe(1);
      expect(pagination.first_page).toBe(1);
      expect(pagination.from).toBe(1);
      expect(pagination.to).toBe(Math.min(defaultPerPage, totalItems));
      expect(pagination.pages).toBe(Math.ceil(totalItems / defaultPerPage));
      expect(pagination.last_page).toBe(pagination.pages);
    });

    it("row count matches requested page size", () => {
      // Fixture should have exactly 100 rows (default per_page)
      expect(rankingsDefault.rows.length).toBeLessThanOrEqual(defaultPerPage);
    });
  });

  describe("buildPaginationQuery with units", () => {
    it("defaults to lbs units", () => {
      const query = scraper.buildPaginationQuery(1, 100);
      expect(query).toContain("units=lbs");
    });

    it("uses kg units when specified", () => {
      const query = scraper.buildPaginationQuery(1, 100, "kg");
      expect(query).toContain("units=kg");
    });

    it("uses lbs units when explicitly specified", () => {
      const query = scraper.buildPaginationQuery(1, 100, "lbs");
      expect(query).toContain("units=lbs");
    });

    it("includes start, end, and lang parameters", () => {
      const query = scraper.buildPaginationQuery(1, 50, "kg");
      expect(query).toContain("start=0");
      expect(query).toContain("end=50");
      expect(query).toContain("lang=en");
      expect(query).toContain("units=kg");
    });

    it("calculates correct start for page 2", () => {
      const query = scraper.buildPaginationQuery(2, 100, "kg");
      expect(query).toContain("start=100");
      expect(query).toContain("end=200");
    });
  });

  describe("parseRankingsCacheKey", () => {
    it("returns null for non-rankings keys", () => {
      expect(rankingService.parseRankingsCacheKey("status")).toBeNull();
      expect(rankingService.parseRankingsCacheKey("user-johnhaack-lbs")).toBeNull();
    });

    it("parses base unfiltered rankings key", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-1-100-lbs")).toEqual({
        filterPath: "",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: undefined,
      });
    });

    it("parses unfiltered rankings key with federation", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-1-100-lbs-uspa")).toEqual({
        filterPath: "",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: "uspa",
      });
    });

    it("parses filtered rankings key", () => {
      expect(rankingService.parseRankingsCacheKey("rankings/raw/men-1-100-lbs")).toEqual({
        filterPath: "/raw/men",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: undefined,
      });
    });

    it("parses deep filter path with age class containing dash", () => {
      expect(rankingService.parseRankingsCacheKey("rankings/raw/men/40-44-1-100-lbs")).toEqual({
        filterPath: "/raw/men/40-44",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: undefined,
      });
    });

    it("parses very deep filter path", () => {
      expect(
        rankingService.parseRankingsCacheKey(
          "rankings/raw/men/100/2024/full-power/by-dots-1-100-lbs",
        ),
      ).toEqual({
        filterPath: "/raw/men/100/2024/full-power/by-dots",
        currentPage: 1,
        perPage: 100,
        units: "lbs",
        federation: undefined,
      });
    });

    it("returns null for keys missing units suffix", () => {
      expect(rankingService.parseRankingsCacheKey("rankings-1-100")).toBeNull();
      expect(rankingService.parseRankingsCacheKey("rankings-invalid")).toBeNull();
      expect(rankingService.parseRankingsCacheKey("rankings-abc-def")).toBeNull();
    });
  });
});

describe("rankings service refreshCacheKey", () => {
  it("returns false for non-rankings keys", async () => {
    expect(await rankingService.refreshCacheKey("status")).toBe(false);
  });

  it("returns true for unfiltered rankings", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

    const result = await rankingService.refreshCacheKey("rankings-1-100-lbs");
    expect(result).toBe(true);
    expect(refreshSpy).toHaveBeenCalledWith("rankings-1-100-lbs", expect.any(Function));
    refreshSpy.mockRestore();
  });

  it("returns true for filtered rankings", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

    const result = await rankingService.refreshCacheKey("rankings/raw/men-1-100-lbs");
    expect(result).toBe(true);
    refreshSpy.mockRestore();
  });
});
