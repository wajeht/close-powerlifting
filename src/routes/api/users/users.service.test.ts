import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import { createUserService, transformCompetitionResults } from "./users.service";
import { userKristyHawkinsHtml, userJohnHaackHtml } from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const userService = createUserService(scraper);
const { defaultPerPage, maxPerPage } = configuration.pagination;

const kristyDoc = scraper.parseHtml(userKristyHawkinsHtml);
const johnDoc = scraper.parseHtml(userJohnHaackHtml);

const kristyProfile = userService.parseUserProfileHtml(kristyDoc, "kristyhawkins");
const johnProfile = userService.parseUserProfileHtml(johnDoc, "johnhaack");

describe.concurrent("users service", () => {
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
});
