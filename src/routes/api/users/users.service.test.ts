import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { userKristyHawkinsHtml, userJohnHaackHtml } from "./fixtures";

describe("users service", () => {
  describe("user HTML parsing", () => {
    test("Kristy Hawkins user HTML parses correctly", () => {
      const doc = parseHtml(userKristyHawkinsHtml);
      expect(doc).toBeDefined();
    });

    test("John Haack user HTML parses correctly", () => {
      const doc = parseHtml(userJohnHaackHtml);
      expect(doc).toBeDefined();
    });
  });

  describe("user name extraction", () => {
    function extractUserName(html: string) {
      const doc = parseHtml(html);
      const h1 = doc.querySelector("h1");
      // Name can be in span.green or just span (with empty class)
      const nameSpan = h1?.querySelector("span.green") || h1?.querySelector("span");
      return nameSpan?.textContent?.trim() || "";
    }

    test("extracts name from Kristy Hawkins profile", () => {
      const name = extractUserName(userKristyHawkinsHtml);
      expect(name).toBe("Kristy Hawkins");
    });

    test("extracts name from John Haack profile", () => {
      const name = extractUserName(userJohnHaackHtml);
      expect(name).toBe("John Haack");
    });
  });

  describe("user sex extraction", () => {
    function extractUserSex(html: string) {
      const doc = parseHtml(html);
      const h1 = doc.querySelector("h1");
      const text = h1?.textContent || "";
      const match = text.match(/\(([MF])\)/);
      return match ? match[1] : "";
    }

    test("extracts sex from Kristy Hawkins profile", () => {
      const sex = extractUserSex(userKristyHawkinsHtml);
      expect(sex).toBe("F");
    });

    test("extracts sex from John Haack profile", () => {
      const sex = extractUserSex(userJohnHaackHtml);
      expect(sex).toBe("M");
    });
  });

  describe("user instagram extraction", () => {
    function extractInstagram(html: string) {
      const doc = parseHtml(html);
      const h1 = doc.querySelector("h1");
      const igLink = h1?.querySelector("a.instagram");
      const href = igLink?.getAttribute("href") || "";
      const match = href.match(/instagram\.com\/([^/]+)/);
      return match ? match[1] : "";
    }

    test("extracts instagram from Kristy Hawkins profile", () => {
      const instagram = extractInstagram(userKristyHawkinsHtml);
      expect(instagram).toBe("kristy_hawkins");
    });

    test("extracts instagram from John Haack profile", () => {
      const instagram = extractInstagram(userJohnHaackHtml);
      expect(instagram.length).toBeGreaterThan(0);
    });
  });

  describe("personal bests extraction", () => {
    function extractPersonalBests(html: string) {
      const doc = parseHtml(html);
      const h2s = doc.querySelectorAll("h2");
      let pbTable = null;

      for (const h2 of h2s) {
        if (h2.textContent?.includes("Personal Bests")) {
          pbTable = h2.nextElementSibling;
          break;
        }
      }

      if (!pbTable || pbTable.tagName !== "TABLE") {
        return [];
      }

      return tableToJson<Record<string, string>>(pbTable);
    }

    test("extracts personal bests from Kristy Hawkins profile", () => {
      const pbs = extractPersonalBests(userKristyHawkinsHtml);
      expect(Array.isArray(pbs)).toBe(true);
      expect(pbs.length).toBeGreaterThan(0);
    });

    test("personal bests have equipment field", () => {
      const pbs = extractPersonalBests(userKristyHawkinsHtml);
      if (pbs.length > 0) {
        const keys = Object.keys(pbs[0]).map((k) => k.toLowerCase());
        const hasEquip = keys.some((k) => k.includes("equip"));
        expect(hasEquip).toBe(true);
      }
    });

    test("personal bests have lift data", () => {
      const pbs = extractPersonalBests(userKristyHawkinsHtml);
      if (pbs.length > 0) {
        const keys = Object.keys(pbs[0]).map((k) => k.toLowerCase());
        const hasSquat = keys.some((k) => k.includes("squat"));
        const hasBench = keys.some((k) => k.includes("bench"));
        const hasDeadlift = keys.some((k) => k.includes("deadlift"));
        const hasTotal = keys.some((k) => k.includes("total"));
        expect(hasSquat || hasBench || hasDeadlift || hasTotal).toBe(true);
      }
    });
  });

  describe("competition results extraction", () => {
    function extractCompetitionResults(html: string) {
      const doc = parseHtml(html);
      const h2s = doc.querySelectorAll("h2");
      let resultsTable = null;

      for (const h2 of h2s) {
        if (h2.textContent?.includes("Competition Results")) {
          resultsTable = h2.nextElementSibling;
          break;
        }
      }

      if (!resultsTable || resultsTable.tagName !== "TABLE") {
        return [];
      }

      return tableToJson<Record<string, string>>(resultsTable);
    }

    test("extracts competition results from Kristy Hawkins profile", () => {
      const results = extractCompetitionResults(userKristyHawkinsHtml);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test("extracts competition results from John Haack profile", () => {
      const results = extractCompetitionResults(userJohnHaackHtml);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test("competition results have expected fields", () => {
      const results = extractCompetitionResults(userKristyHawkinsHtml);
      if (results.length > 0) {
        const keys = Object.keys(results[0]).map((k) => k.toLowerCase());
        const hasPlace = keys.some((k) => k.includes("place"));
        const hasFed = keys.some((k) => k.includes("fed"));
        const hasDate = keys.some((k) => k.includes("date"));
        expect(hasPlace || hasFed || hasDate).toBe(true);
      }
    });
  });

  describe("full user data extraction", () => {
    function extractUserData(html: string) {
      const doc = parseHtml(html);

      const h1 = doc.querySelector("h1");
      // Name can be in span.green or just span (with empty class)
      const nameSpan = h1?.querySelector("span.green") || h1?.querySelector("span");
      const name = nameSpan?.textContent?.trim() || "";

      const h1Text = h1?.textContent || "";
      const sexMatch = h1Text.match(/\(([MF])\)/);
      const sex = sexMatch ? sexMatch[1] : "";

      const igLink = h1?.querySelector("a.instagram");
      const igHref = igLink?.getAttribute("href") || "";
      const igMatch = igHref.match(/instagram\.com\/([^/]+)/);
      const instagram = igMatch ? igMatch[1] : "";

      const h2s = doc.querySelectorAll("h2");
      let pbTable = null;
      let resultsTable = null;

      for (const h2 of h2s) {
        const text = h2.textContent || "";
        if (text.includes("Personal Bests")) {
          pbTable = h2.nextElementSibling;
        } else if (text.includes("Competition Results")) {
          resultsTable = h2.nextElementSibling;
        }
      }

      return {
        name,
        sex,
        instagram,
        personalBests: pbTable?.tagName === "TABLE" ? tableToJson<Record<string, string>>(pbTable) : [],
        competitionResults:
          resultsTable?.tagName === "TABLE" ? tableToJson<Record<string, string>>(resultsTable) : [],
      };
    }

    test("extracts complete user data from Kristy Hawkins profile", () => {
      const userData = extractUserData(userKristyHawkinsHtml);

      expect(userData.name).toBe("Kristy Hawkins");
      expect(userData.sex).toBe("F");
      expect(userData.instagram).toBe("kristy_hawkins");
      expect(Array.isArray(userData.personalBests)).toBe(true);
      expect(userData.personalBests.length).toBeGreaterThan(0);
      expect(Array.isArray(userData.competitionResults)).toBe(true);
      expect(userData.competitionResults.length).toBeGreaterThan(0);
    });

    test("extracts complete user data from John Haack profile", () => {
      const userData = extractUserData(userJohnHaackHtml);

      expect(userData.name).toBe("John Haack");
      expect(userData.sex).toBe("M");
      expect(Array.isArray(userData.personalBests)).toBe(true);
      expect(Array.isArray(userData.competitionResults)).toBe(true);
    });
  });
});
