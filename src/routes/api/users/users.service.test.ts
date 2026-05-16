import { describe, expect, it, vi } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import {
  createUserService,
  transformCompetitionResults,
  buildProgression,
  buildPersonalBests,
  buildComparisonSummary,
  findSharedMeets,
  buildUserRank,
} from "./users.service";
import { userKristyHawkinsHtml, userJohnHaackHtml } from "./fixtures";
import { rankingsDefault } from "../rankings/fixtures";

const context = createContext();
const scraper = context.scraper;
const userService = createUserService(context.knex, scraper);
const { defaultPerPage, maxPerPage } = configuration.pagination;

const kristyDoc = scraper.parseHtml(userKristyHawkinsHtml);
const johnDoc = scraper.parseHtml(userJohnHaackHtml);

const kristyProfile = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins");
const johnProfile = userService.parseUserProfileHtml(johnDoc, "johnhaack");

describe("users service", () => {
  describe("parseUserProfileHtml", () => {
    it("parses Kristy Hawkins profile HTML correctly", () => {
      expect(kristyProfile).toBeDefined();
    });

    it("parses John Haack profile HTML correctly", () => {
      expect(johnProfile).toBeDefined();
    });

    it("returns UserProfile structure", () => {
      expect(kristyProfile).toHaveProperty("name");
      expect(kristyProfile).toHaveProperty("username");
      expect(kristyProfile).toHaveProperty("sex");
      expect(kristyProfile).toHaveProperty("instagram");
      expect(kristyProfile).toHaveProperty("instagram_url");
      expect(kristyProfile).toHaveProperty("personal_best");
      expect(kristyProfile).toHaveProperty("competition_results");
    });

    it("extracts name from Kristy Hawkins profile", () => {
      expect(kristyProfile.name).toBe("Kristy Hawkins");
    });

    it("extracts name from John Haack profile", () => {
      expect(johnProfile.name).toBe("John Haack");
    });

    it("extracts sex from Kristy Hawkins profile", () => {
      expect(kristyProfile.sex).toBe("F");
    });

    it("extracts sex from John Haack profile", () => {
      expect(johnProfile.sex).toBe("M");
    });

    it("extracts instagram from Kristy Hawkins profile", () => {
      expect(kristyProfile.instagram).toBe("kristy_hawkins");
    });

    it("generates instagram URL", () => {
      expect(kristyProfile.instagram_url).toBe("https://www.instagram.com/kristy_hawkins");
    });

    it("extracts instagram from John Haack profile", () => {
      expect(johnProfile.instagram.length).toBeGreaterThan(0);
    });

    it("extracts personal bests from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyProfile.personal_best)).toBe(true);
      expect(kristyProfile.personal_best.length).toBeGreaterThan(0);
    });

    it("personal bests have equipment field", () => {
      if (kristyProfile.personal_best.length > 0) {
        const keys = Object.keys(kristyProfile.personal_best[0]).map((k) => k.toLowerCase());
        const hasEquip = keys.some((k) => k.includes("equip"));
        expect(hasEquip).toBe(true);
      }
    });

    it("personal bests have lift data", () => {
      if (kristyProfile.personal_best.length > 0) {
        const keys = Object.keys(kristyProfile.personal_best[0]).map((k) => k.toLowerCase());
        const hasSquat = keys.some((k) => k.includes("squat"));
        const hasBench = keys.some((k) => k.includes("bench"));
        const hasDeadlift = keys.some((k) => k.includes("deadlift"));
        const hasTotal = keys.some((k) => k.includes("total"));
        expect(hasSquat || hasBench || hasDeadlift || hasTotal).toBe(true);
      }
    });

    it("extracts competition results from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyProfile.competition_results)).toBe(true);
      expect(kristyProfile.competition_results.length).toBeGreaterThan(0);
    });

    it("extracts competition results from John Haack profile", () => {
      expect(Array.isArray(johnProfile.competition_results)).toBe(true);
      expect(johnProfile.competition_results.length).toBeGreaterThan(0);
    });

    it("competition results have expected fields", () => {
      if (kristyProfile.competition_results.length > 0) {
        const keys = Object.keys(kristyProfile.competition_results[0]).map((k) => k.toLowerCase());
        const hasPlace = keys.some((k) => k.includes("place"));
        const hasFed = keys.some((k) => k.includes("fed"));
        const hasDate = keys.some((k) => k.includes("date"));
        expect(hasPlace || hasFed || hasDate).toBe(true);
      }
    });

    it("competition results have squat, bench, deadlift, total, and dots fields", () => {
      const first = johnProfile.competition_results[0]!;
      expect(first).toHaveProperty("squat");
      expect(first).toHaveProperty("bench");
      expect(first).toHaveProperty("deadlift");
      expect(first).toHaveProperty("total");
      expect(first).toHaveProperty("dots");
    });

    it("competition results do not contain numbered attempt columns", () => {
      const first = johnProfile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(false);
    });

    it("extracts numeric squat from John Haack first competition", () => {
      const first = johnProfile.competition_results[0]!;
      expect(Number(first.squat)).toBeGreaterThan(0);
    });

    it("extracts numeric bench from John Haack first competition", () => {
      const first = johnProfile.competition_results[0]!;
      expect(Number(first.bench)).toBeGreaterThan(0);
    });

    it("extracts numeric deadlift from John Haack first competition", () => {
      const first = johnProfile.competition_results[0]!;
      expect(Number(first.deadlift)).toBeGreaterThan(0);
    });

    it("preserves total and dots values", () => {
      const first = johnProfile.competition_results[0]!;
      expect(Number(first.total)).toBeGreaterThan(0);
      expect(Number(first.dots)).toBeGreaterThan(0);
    });
  });

  describe("parseUserProfileHtml with includeAttempts", () => {
    it("returns raw attempt columns when includeAttempts is true", () => {
      const profile = userService.parseUserProfileHtml(johnDoc, "johnhaack", true);
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(true);
    });

    it("strips attempt columns when includeAttempts is false", () => {
      const profile = userService.parseUserProfileHtml(johnDoc, "johnhaack", false);
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(false);
    });

    it("strips attempt columns by default (no includeAttempts param)", () => {
      const profile = userService.parseUserProfileHtml(johnDoc, "johnhaack");
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(false);
    });

    it("preserves best lift values when includeAttempts is true", () => {
      const profile = userService.parseUserProfileHtml(johnDoc, "johnhaack", true);
      const first = profile.competition_results[0]!;
      expect(first).toHaveProperty("total");
      expect(first).toHaveProperty("dots");
    });

    it("still returns same non-attempt fields regardless of includeAttempts", () => {
      const withAttempts = userService.parseUserProfileHtml(johnDoc, "johnhaack", true);
      const withoutAttempts = userService.parseUserProfileHtml(johnDoc, "johnhaack", false);

      expect(withAttempts.name).toBe(withoutAttempts.name);
      expect(withAttempts.username).toBe(withoutAttempts.username);
      expect(withAttempts.sex).toBe(withoutAttempts.sex);
      expect(withAttempts.instagram).toBe(withoutAttempts.instagram);
      expect(withAttempts.personal_best).toEqual(withoutAttempts.personal_best);
    });
  });

  describe("parseUserProfileHtml with Kristy Hawkins and includeAttempts", () => {
    it("Kristy Hawkins with includeAttempts=true has attempt columns", () => {
      const profile = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins", true);
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(true);
    });

    it("Kristy Hawkins with includeAttempts=false strips attempt columns", () => {
      const profile = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins", false);
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(false);
    });

    it("Kristy Hawkins with includeAttempts=true has more keys than without", () => {
      const withAttempts = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins", true);
      const withoutAttempts = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins", false);

      const keysWithAttempts = Object.keys(withAttempts.competition_results[0]!);
      const keysWithoutAttempts = Object.keys(withoutAttempts.competition_results[0]!);
      expect(keysWithAttempts.length).toBeGreaterThan(keysWithoutAttempts.length);
    });

    it("Kristy Hawkins default (no includeAttempts) strips attempt columns", () => {
      const profile = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins");
      const first = profile.competition_results[0]!;
      const keys = Object.keys(first);
      const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
      expect(hasNumberedColumns).toBe(false);
    });
  });

  describe("transformCompetitionResults edge cases", () => {
    it("picks best successful attempt ignoring failed ones (negative values)", () => {
      const rows = [
        {
          place: "1",
          squat1: "200",
          squat2: "-210",
          squat3: "215",
          squat4: "",
          bench1: "-100",
          bench2: "-100",
          bench3: "100",
          bench4: "",
          deadlift1: "250",
          deadlift2: "260",
          deadlift3: "-270",
          deadlift4: "",
          total: "575",
          dots: "400",
        },
      ];

      const result = transformCompetitionResults(rows);
      expect(result[0].squat).toBe("215");
      expect(result[0].bench).toBe("100");
      expect(result[0].deadlift).toBe("260");
    });

    it("returns empty string when all attempts are empty", () => {
      const rows = [
        {
          place: "1",
          squat1: "",
          squat2: "",
          squat3: "",
          squat4: "",
          bench1: "100",
          bench2: "",
          bench3: "",
          bench4: "",
          deadlift1: "",
          deadlift2: "",
          deadlift3: "",
          deadlift4: "",
          total: "100",
          dots: "50",
        },
      ];

      const result = transformCompetitionResults(rows);
      expect(result[0].squat).toBe("");
      expect(result[0].bench).toBe("100");
      expect(result[0].deadlift).toBe("");
    });

    it("returns empty string when all attempts for a lift failed", () => {
      const rows = [
        {
          place: "DQ",
          squat1: "-200",
          squat2: "-210",
          squat3: "-220",
          squat4: "",
          bench1: "100",
          bench2: "",
          bench3: "",
          bench4: "",
          deadlift1: "-250",
          deadlift2: "-260",
          deadlift3: "-270",
          deadlift4: "",
          total: "",
          dots: "",
        },
      ];

      const result = transformCompetitionResults(rows);
      expect(result[0].squat).toBe("");
      expect(result[0].bench).toBe("100");
      expect(result[0].deadlift).toBe("");
    });

    it("preserves non-attempt columns unchanged", () => {
      const rows = [
        {
          place: "1",
          fed: "USPA",
          date: "2024-01-01",
          squat1: "200",
          squat2: "",
          squat3: "",
          squat4: "",
          bench1: "100",
          bench2: "",
          bench3: "",
          bench4: "",
          deadlift1: "250",
          deadlift2: "",
          deadlift3: "",
          deadlift4: "",
          total: "550",
          dots: "400",
        },
      ];

      const result = transformCompetitionResults(rows);
      expect(result[0].place).toBe("1");
      expect(result[0].fed).toBe("USPA");
      expect(result[0].date).toBe("2024-01-01");
      expect(result[0].total).toBe("550");
    });
  });

  describe("pagination config", () => {
    it("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    it("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    it("default per_page is within max limit", () => {
      expect(defaultPerPage).toBeLessThanOrEqual(maxPerPage);
    });
  });

  describe("buildProgression", () => {
    it("returns one point per competition_results row", () => {
      const points = buildProgression(johnProfile);
      expect(points.length).toBe(johnProfile.competition_results.length);
    });

    it("each point exposes date, meet, total, dots, place", () => {
      const points = buildProgression(johnProfile);
      const first = points[0]!;
      expect(first).toHaveProperty("date");
      expect(first).toHaveProperty("meet");
      expect(first).toHaveProperty("total");
      expect(first).toHaveProperty("dots");
      expect(first).toHaveProperty("place");
    });

    it("points are sorted ascending by date", () => {
      const points = buildProgression(johnProfile);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        if (prev.date && curr.date) {
          expect(prev.date.localeCompare(curr.date)).toBeLessThanOrEqual(0);
        }
      }
    });

    it("returns empty array when profile has no competition_results", () => {
      const empty = { ...johnProfile, competition_results: [] };
      expect(buildProgression(empty)).toEqual([]);
    });
  });

  describe("buildPersonalBests", () => {
    it("groups PBs by equipment", () => {
      const bests = buildPersonalBests(johnProfile);
      expect(Array.isArray(bests)).toBe(true);
      expect(bests.length).toBeGreaterThan(0);
      const equipments = bests.map((b) => b.equipment);
      expect(new Set(equipments).size).toBe(equipments.length);
    });

    it("each entry has squat, bench, deadlift, total, dots", () => {
      const bests = buildPersonalBests(johnProfile);
      const first = bests[0]!;
      expect(first).toHaveProperty("squat");
      expect(first).toHaveProperty("bench");
      expect(first).toHaveProperty("deadlift");
      expect(first).toHaveProperty("total");
      expect(first).toHaveProperty("dots");
    });

    it("each PB entry includes meet, date, federation alongside value", () => {
      const bests = buildPersonalBests(johnProfile);
      for (const equipBest of bests) {
        if (equipBest.total.value !== "") {
          expect(equipBest.total).toHaveProperty("meet");
          expect(equipBest.total).toHaveProperty("date");
          expect(equipBest.total).toHaveProperty("federation");
        }
      }
    });

    it("picks the highest numeric value for each lift", () => {
      const bests = buildPersonalBests(johnProfile);
      for (const equipBest of bests) {
        const totals = johnProfile.competition_results
          .filter((r) => {
            const equip = Object.entries(r).find(([k]) => k.toLowerCase() === "equip")?.[1] ?? "";
            return equip === equipBest.equipment;
          })
          .map((r) => parseFloat(r.total ?? "0"))
          .filter((n) => n > 0);
        if (totals.length === 0) continue;
        const maxTotal = Math.max(...totals);
        if (equipBest.total.value !== "") {
          expect(parseFloat(equipBest.total.value)).toBe(maxTotal);
        }
      }
    });

    it("returns empty array when profile has no competition_results", () => {
      const empty = { ...johnProfile, competition_results: [] };
      expect(buildPersonalBests(empty)).toEqual([]);
    });
  });

  describe("buildComparisonSummary", () => {
    it("contains identifying info and aggregate bests", () => {
      const summary = buildComparisonSummary(johnProfile);
      expect(summary.name).toBe(johnProfile.name);
      expect(summary.username).toBe(johnProfile.username);
      expect(summary.sex).toBe(johnProfile.sex);
      expect(summary.total_meets).toBe(johnProfile.competition_results.length);
      expect(parseFloat(summary.best_total)).toBeGreaterThan(0);
      expect(parseFloat(summary.best_dots)).toBeGreaterThan(0);
    });

    it("first_meet_date is the earliest date in results", () => {
      const summary = buildComparisonSummary(johnProfile);
      const allDates = johnProfile.competition_results
        .map((r) => r.date ?? "")
        .filter((d) => d !== "")
        .sort();
      if (allDates.length > 0) {
        expect(summary.first_meet_date).toBe(allDates[0]);
        expect(summary.last_meet_date).toBe(allDates[allDates.length - 1]);
      }
    });
  });

  describe("findSharedMeets", () => {
    it("returns empty array when two lifters never overlap", () => {
      const shared = findSharedMeets(johnProfile, kristyProfile);
      expect(Array.isArray(shared)).toBe(true);
    });

    it("matches an entry when two lifters share date+meet", () => {
      const sharedMeet = johnProfile.competition_results[0]!;
      const fakeOther = {
        ...kristyProfile,
        competition_results: [
          {
            ...sharedMeet,
            place: "5",
            total: "1500",
            dots: "500",
          },
        ],
      };
      const result = findSharedMeets(johnProfile, fakeOther);
      expect(result.length).toBe(1);
      expect(result[0]!.b_total).toBe("1500");
      expect(result[0]!.a_total).toBe(sharedMeet.total ?? "");
    });

    it("returns empty when one profile has no results", () => {
      const empty = { ...kristyProfile, competition_results: [] };
      const result = findSharedMeets(johnProfile, empty);
      expect(result).toEqual([]);
    });
  });

  describe("buildUserRank", () => {
    it("returns the supplied global_rank value", () => {
      const rank = buildUserRank(johnProfile, 42);
      expect(rank.global_rank).toBe(42);
    });

    it("global_rank is null when supplied null", () => {
      const rank = buildUserRank(johnProfile, null);
      expect(rank.global_rank).toBeNull();
    });

    it("includes name, username, sex, best_total, best_dots", () => {
      const rank = buildUserRank(johnProfile, 1);
      expect(rank.name).toBe(johnProfile.name);
      expect(rank.username).toBe(johnProfile.username);
      expect(rank.sex).toBe(johnProfile.sex);
      expect(parseFloat(rank.best_total)).toBeGreaterThan(0);
      expect(parseFloat(rank.best_dots)).toBeGreaterThan(0);
    });

    it("best_equipment + best_weight_class come from the row with highest DOTS", () => {
      const rank = buildUserRank(johnProfile, null);
      let topDots = 0;
      let expectedEquip = "";
      let expectedClass = "";
      for (const row of johnProfile.competition_results) {
        const dots = parseFloat(row.dots ?? "0");
        if (dots > topDots) {
          topDots = dots;
          expectedEquip = (Object.entries(row).find(([k]) => k.toLowerCase() === "equip")?.[1] ??
            "") as string;
          expectedClass = (Object.entries(row).find(([k]) => k.toLowerCase() === "class")?.[1] ??
            "") as string;
        }
      }
      expect(rank.best_equipment).toBe(expectedEquip);
      expect(rank.best_weight_class).toBe(expectedClass);
    });
  });

  describe("getProgression service method", () => {
    it("returns null for unknown user", async () => {
      const result = await userService.getProgression({ username: "ghost" });
      expect(result).toBeNull();
    });

    it("returns sorted progression points when profile exists", async () => {
      const result = await userService.getProgression({ username: "johnhaack" });
      expect(result).not.toBeNull();
      expect(result!.length).toBeGreaterThan(0);
    });
  });

  describe("getPersonalBests service method", () => {
    it("returns null for unknown user", async () => {
      const result = await userService.getPersonalBests({ username: "ghost" });
      expect(result).toBeNull();
    });

    it("returns PBs grouped by equipment when profile exists", async () => {
      const result = await userService.getPersonalBests({ username: "johnhaack" });
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("compareUsers service method", () => {
    it("returns null when either user is missing", async () => {
      const result = await userService.compareUsers({ a: "johnhaack", b: "ghost" });
      expect(result).toBeNull();
    });

    it("returns a UserComparison when both profiles exist", async () => {
      const result = await userService.compareUsers({ a: "johnhaack", b: "kristyhawkins" });
      expect(result).not.toBeNull();
      expect(result!.a.username).toBe("johnhaack");
      expect(result!.b.username).toBe("kristyhawkins");
      expect(Array.isArray(result!.shared_meets)).toBe(true);
    });
  });

  describe("getRank service method", () => {
    it("returns null for unknown user", async () => {
      const result = await userService.getRank({ username: "ghost" });
      expect(result).toBeNull();
    });

    it("returns rank with global_rank when profile + search succeed", async () => {
      const cacheSpy = vi
        .spyOn(scraper, "withCache")
        .mockImplementationOnce(async (_key, fn) => ({ data: await fn() }));
      const fetchSpy = vi
        .spyOn(scraper, "fetchJson")
        .mockResolvedValueOnce({ next_index: 41 } as never);

      const result = await userService.getRank({ username: "johnhaack" });
      expect(result).not.toBeNull();
      expect(result!.username).toBe("johnhaack");
      expect(result!.global_rank).toBe(42);
      cacheSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });

  describe("searchUser", () => {
    it("uses an exclusive end index when fetching search rankings", async () => {
      await context.cache.del("users-search-unique-haack-search-1-5-kg");

      const fetchJsonSpy = vi
        .spyOn(scraper, "fetchJson")
        .mockImplementationOnce(async () => ({ next_index: 42 }))
        .mockImplementationOnce(async () => rankingsDefault);

      const result = await userService.searchUser({
        search: "unique-haack-search",
        per_page: 5,
        current_page: 1,
        units: "kg",
      });

      expect(result.data).not.toBeNull();
      expect(fetchJsonSpy).toHaveBeenNthCalledWith(
        1,
        "/search/rankings?q=unique-haack-search&start=0",
      );
      expect(fetchJsonSpy).toHaveBeenNthCalledWith(2, "/rankings?start=42&end=47&lang=en&units=kg");
    });
  });

  describe("parseUserCacheKey", () => {
    it("returns null for non-user keys", () => {
      expect(userService.parseUserCacheKey("status")).toBeNull();
      expect(userService.parseUserCacheKey("meet-uspa/1969")).toBeNull();
    });

    it("parses profile key with units", () => {
      expect(userService.parseUserCacheKey("user-johnhaack-lbs")).toEqual({
        kind: "profile",
        username: "johnhaack",
        includeAttempts: false,
        units: "lbs",
      });
      expect(userService.parseUserCacheKey("user-johnhaack-kg")).toEqual({
        kind: "profile",
        username: "johnhaack",
        includeAttempts: false,
        units: "kg",
      });
    });

    it("parses profile key with attempts", () => {
      expect(userService.parseUserCacheKey("user-johnhaack-attempts-lbs")).toEqual({
        kind: "profile",
        username: "johnhaack",
        includeAttempts: true,
        units: "lbs",
      });
    });

    it("parses rank key", () => {
      expect(userService.parseUserCacheKey("user-johnhaack-rank")).toEqual({
        kind: "rank",
        username: "johnhaack",
      });
    });

    it("parses search key", () => {
      expect(userService.parseUserCacheKey("users-search-haack-1-100-lbs")).toEqual({
        kind: "search",
        search: "haack",
        current_page: 1,
        per_page: 100,
        units: "lbs",
      });
    });

    it("decodes URL-encoded search query", () => {
      expect(userService.parseUserCacheKey("users-search-john%20haack-2-5-kg")).toEqual({
        kind: "search",
        search: "john haack",
        current_page: 2,
        per_page: 5,
        units: "kg",
      });
    });

    it("returns null for user key without units suffix", () => {
      expect(userService.parseUserCacheKey("user-johnhaack")).toBeNull();
    });

    it("handles usernames with hyphens", () => {
      expect(userService.parseUserCacheKey("user-john-doe-lbs")).toEqual({
        kind: "profile",
        username: "john-doe",
        includeAttempts: false,
        units: "lbs",
      });
    });

    it("returns null for invalid search key", () => {
      expect(userService.parseUserCacheKey("users-search-haack-invalid")).toBeNull();
    });
  });

  describe("refreshCacheKey", () => {
    it("returns false for non-user keys", async () => {
      expect(await userService.refreshCacheKey("status")).toBe(false);
      expect(await userService.refreshCacheKey("meet-uspa/1969")).toBe(false);
    });

    it("returns true for a profile key without re-scraping (data now served from lifts)", async () => {
      const refreshSpy = vi.spyOn(scraper, "refreshCache");

      const result = await userService.refreshCacheKey("user-johnhaack-lbs");

      expect(result).toBe(true);
      expect(refreshSpy).not.toHaveBeenCalled();
      refreshSpy.mockRestore();
    });

    it("returns true for a rank key", async () => {
      const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

      const result = await userService.refreshCacheKey("user-johnhaack-rank");

      expect(result).toBe(true);
      expect(refreshSpy).toHaveBeenCalledWith("user-johnhaack-rank", expect.any(Function));
      refreshSpy.mockRestore();
    });

    it("returns true for a search key", async () => {
      const refreshSpy = vi.spyOn(scraper, "refreshCache").mockResolvedValueOnce({ data: null });

      const result = await userService.refreshCacheKey("users-search-haack-1-100-lbs");

      expect(result).toBe(true);
      expect(refreshSpy).toHaveBeenCalledWith("users-search-haack-1-100-lbs", expect.any(Function));
      refreshSpy.mockRestore();
    });
  });
});
