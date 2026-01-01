import { describe, expect, test } from "vitest";

import { config } from "../../../config";
import { parseHtml } from "../../../utils/scraper";
import { parseUserProfileHtml } from "./users.service";
import { userKristyHawkinsHtml, userJohnHaackHtml } from "./fixtures";

const { defaultPerPage, maxPerPage } = config.pagination;

const kristyDoc = parseHtml(userKristyHawkinsHtml);
const johnDoc = parseHtml(userJohnHaackHtml);

const kristyProfile = parseUserProfileHtml(kristyDoc, "kristyhawkins");
const johnProfile = parseUserProfileHtml(johnDoc, "johnhaack");

describe("users service", () => {
  describe("parseUserProfileHtml", () => {
    test("parses Kristy Hawkins profile HTML correctly", () => {
      expect(kristyProfile).toBeDefined();
    });

    test("parses John Haack profile HTML correctly", () => {
      expect(johnProfile).toBeDefined();
    });

    test("returns UserProfile structure", () => {
      expect(kristyProfile).toHaveProperty("name");
      expect(kristyProfile).toHaveProperty("username");
      expect(kristyProfile).toHaveProperty("sex");
      expect(kristyProfile).toHaveProperty("instagram");
      expect(kristyProfile).toHaveProperty("instagram_url");
      expect(kristyProfile).toHaveProperty("personal_best");
      expect(kristyProfile).toHaveProperty("competition_results");
    });

    test("extracts name from Kristy Hawkins profile", () => {
      expect(kristyProfile.name).toBe("Kristy Hawkins");
    });

    test("extracts name from John Haack profile", () => {
      expect(johnProfile.name).toBe("John Haack");
    });

    test("extracts sex from Kristy Hawkins profile", () => {
      expect(kristyProfile.sex).toBe("F");
    });

    test("extracts sex from John Haack profile", () => {
      expect(johnProfile.sex).toBe("M");
    });

    test("extracts instagram from Kristy Hawkins profile", () => {
      expect(kristyProfile.instagram).toBe("kristy_hawkins");
    });

    test("generates instagram URL", () => {
      expect(kristyProfile.instagram_url).toBe("https://www.instagram.com/kristy_hawkins");
    });

    test("extracts instagram from John Haack profile", () => {
      expect(johnProfile.instagram.length).toBeGreaterThan(0);
    });

    test("extracts personal bests from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyProfile.personal_best)).toBe(true);
      expect(kristyProfile.personal_best.length).toBeGreaterThan(0);
    });

    test("personal bests have equipment field", () => {
      if (kristyProfile.personal_best.length > 0) {
        const keys = Object.keys(kristyProfile.personal_best[0]).map((k) => k.toLowerCase());
        const hasEquip = keys.some((k) => k.includes("equip"));
        expect(hasEquip).toBe(true);
      }
    });

    test("personal bests have lift data", () => {
      if (kristyProfile.personal_best.length > 0) {
        const keys = Object.keys(kristyProfile.personal_best[0]).map((k) => k.toLowerCase());
        const hasSquat = keys.some((k) => k.includes("squat"));
        const hasBench = keys.some((k) => k.includes("bench"));
        const hasDeadlift = keys.some((k) => k.includes("deadlift"));
        const hasTotal = keys.some((k) => k.includes("total"));
        expect(hasSquat || hasBench || hasDeadlift || hasTotal).toBe(true);
      }
    });

    test("extracts competition results from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyProfile.competition_results)).toBe(true);
      expect(kristyProfile.competition_results.length).toBeGreaterThan(0);
    });

    test("extracts competition results from John Haack profile", () => {
      expect(Array.isArray(johnProfile.competition_results)).toBe(true);
      expect(johnProfile.competition_results.length).toBeGreaterThan(0);
    });

    test("competition results have expected fields", () => {
      if (kristyProfile.competition_results.length > 0) {
        const keys = Object.keys(kristyProfile.competition_results[0]).map((k) => k.toLowerCase());
        const hasPlace = keys.some((k) => k.includes("place"));
        const hasFed = keys.some((k) => k.includes("fed"));
        const hasDate = keys.some((k) => k.includes("date"));
        expect(hasPlace || hasFed || hasDate).toBe(true);
      }
    });
  });

  describe("pagination config", () => {
    test("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    test("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    test("default per_page is within max limit", () => {
      expect(defaultPerPage).toBeLessThanOrEqual(maxPerPage);
    });
  });
});
