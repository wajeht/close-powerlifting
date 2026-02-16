import { describe, expect, it } from "vitest";

import { configuration } from "../../../configuration";
import { createContext } from "../../../context";
import { createUserService } from "./users.service";
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

    it("extracts best squat from John Haack first competition", () => {
      // First comp: squat attempts 320, 350, 372.5, empty
      // Best successful squat = 372.5
      const first = johnProfile.competition_results[0]!;
      expect(first.squat).toBe("372.5");
    });

    it("extracts best bench from John Haack first competition", () => {
      // First comp: bench attempts 230, 250, -260 (failed), empty
      // Best successful bench = 250
      const first = johnProfile.competition_results[0]!;
      expect(first.bench).toBe("250");
    });

    it("extracts best deadlift from John Haack first competition", () => {
      // First comp: deadlift attempts 370, 392.5, -402.5 (failed), empty
      // Best successful deadlift = 392.5
      const first = johnProfile.competition_results[0]!;
      expect(first.deadlift).toBe("392.5");
    });

    it("preserves total and dots values", () => {
      const first = johnProfile.competition_results[0]!;
      expect(first.total).toBe("1015");
      expect(first.dots).toBe("628.33");
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
