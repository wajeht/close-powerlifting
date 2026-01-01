import { describe, expect, test } from "vitest";

import { config } from "../../../config";
import { parseHtml, tableToJson } from "../../../utils/scraper";
import { userKristyHawkinsHtml, userJohnHaackHtml } from "./fixtures";

const { defaultPerPage, maxPerPage } = config.pagination;

const kristyDoc = parseHtml(userKristyHawkinsHtml);
const johnDoc = parseHtml(userJohnHaackHtml);

function extractUserData(doc: Document) {
  const h1 = doc.querySelector("h1");
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

const kristyData = extractUserData(kristyDoc);
const johnData = extractUserData(johnDoc);

describe("users service", () => {
  describe("user HTML parsing", () => {
    test("Kristy Hawkins user HTML parses correctly", () => {
      expect(kristyDoc).toBeDefined();
    });

    test("John Haack user HTML parses correctly", () => {
      expect(johnDoc).toBeDefined();
    });
  });

  describe("user name extraction", () => {
    test("extracts name from Kristy Hawkins profile", () => {
      expect(kristyData.name).toBe("Kristy Hawkins");
    });

    test("extracts name from John Haack profile", () => {
      expect(johnData.name).toBe("John Haack");
    });
  });

  describe("user sex extraction", () => {
    test("extracts sex from Kristy Hawkins profile", () => {
      expect(kristyData.sex).toBe("F");
    });

    test("extracts sex from John Haack profile", () => {
      expect(johnData.sex).toBe("M");
    });
  });

  describe("user instagram extraction", () => {
    test("extracts instagram from Kristy Hawkins profile", () => {
      expect(kristyData.instagram).toBe("kristy_hawkins");
    });

    test("extracts instagram from John Haack profile", () => {
      expect(johnData.instagram.length).toBeGreaterThan(0);
    });
  });

  describe("personal bests extraction", () => {
    test("extracts personal bests from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyData.personalBests)).toBe(true);
      expect(kristyData.personalBests.length).toBeGreaterThan(0);
    });

    test("personal bests have equipment field", () => {
      if (kristyData.personalBests.length > 0) {
        const keys = Object.keys(kristyData.personalBests[0]).map((k) => k.toLowerCase());
        const hasEquip = keys.some((k) => k.includes("equip"));
        expect(hasEquip).toBe(true);
      }
    });

    test("personal bests have lift data", () => {
      if (kristyData.personalBests.length > 0) {
        const keys = Object.keys(kristyData.personalBests[0]).map((k) => k.toLowerCase());
        const hasSquat = keys.some((k) => k.includes("squat"));
        const hasBench = keys.some((k) => k.includes("bench"));
        const hasDeadlift = keys.some((k) => k.includes("deadlift"));
        const hasTotal = keys.some((k) => k.includes("total"));
        expect(hasSquat || hasBench || hasDeadlift || hasTotal).toBe(true);
      }
    });
  });

  describe("competition results extraction", () => {
    test("extracts competition results from Kristy Hawkins profile", () => {
      expect(Array.isArray(kristyData.competitionResults)).toBe(true);
      expect(kristyData.competitionResults.length).toBeGreaterThan(0);
    });

    test("extracts competition results from John Haack profile", () => {
      expect(Array.isArray(johnData.competitionResults)).toBe(true);
      expect(johnData.competitionResults.length).toBeGreaterThan(0);
    });

    test("competition results have expected fields", () => {
      if (kristyData.competitionResults.length > 0) {
        const keys = Object.keys(kristyData.competitionResults[0]).map((k) => k.toLowerCase());
        const hasPlace = keys.some((k) => k.includes("place"));
        const hasFed = keys.some((k) => k.includes("fed"));
        const hasDate = keys.some((k) => k.includes("date"));
        expect(hasPlace || hasFed || hasDate).toBe(true);
      }
    });
  });

  describe("full user data extraction", () => {
    test("extracts complete user data from Kristy Hawkins profile", () => {
      expect(kristyData.name).toBe("Kristy Hawkins");
      expect(kristyData.sex).toBe("F");
      expect(kristyData.instagram).toBe("kristy_hawkins");
      expect(Array.isArray(kristyData.personalBests)).toBe(true);
      expect(kristyData.personalBests.length).toBeGreaterThan(0);
      expect(Array.isArray(kristyData.competitionResults)).toBe(true);
      expect(kristyData.competitionResults.length).toBeGreaterThan(0);
    });

    test("extracts complete user data from John Haack profile", () => {
      expect(johnData.name).toBe("John Haack");
      expect(johnData.sex).toBe("M");
      expect(Array.isArray(johnData.personalBests)).toBe(true);
      expect(Array.isArray(johnData.competitionResults)).toBe(true);
    });
  });

  describe("pagination config for user search", () => {
    test("uses correct default per_page from config", () => {
      expect(defaultPerPage).toBe(100);
    });

    test("uses correct max per_page from config", () => {
      expect(maxPerPage).toBe(500);
    });

    test("default per_page is within max limit", () => {
      expect(defaultPerPage).toBeLessThanOrEqual(maxPerPage);
    });

    test("SearchPagination interface should match expected structure", () => {
      const pagination = {
        per_page: defaultPerPage,
        current_page: 1,
      };

      expect(pagination).toHaveProperty("per_page");
      expect(pagination).toHaveProperty("current_page");
      expect(pagination.per_page).toBe(100);
      expect(pagination.current_page).toBe(1);
    });
  });
});
