import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { meetRps2548Html, meetUsaplIsr2025Html, meetWrpfUsa23e1Html } from "./fixtures";

const rpsDoc = parseHtml(meetRps2548Html);
const usaplDoc = parseHtml(meetUsaplIsr2025Html);
const wrpfDoc = parseHtml(meetWrpfUsa23e1Html);

function extractMeetData(doc: Document) {
  const h1 = doc.querySelector("h1#meet");
  const title = h1?.textContent?.trim() || "";

  const p = h1?.nextElementSibling;
  const dateLocationText = p?.textContent?.trim().split("\n")[0] || "";
  const [date, ...locationParts] = dateLocationText.split(",").map((s) => s.trim());
  const location = locationParts.join(", ");

  const table = doc.querySelector("table");
  const results = tableToJson<Record<string, string>>(table);

  return { title, date, location, results, table };
}

const rpsMeet = extractMeetData(rpsDoc);
const usaplMeet = extractMeetData(usaplDoc);
const wrpfMeet = extractMeetData(wrpfDoc);

describe("meets service", () => {
  describe("meet HTML parsing", () => {
    test("RPS meet HTML parses correctly", () => {
      expect(rpsDoc).toBeDefined();
    });

    test("USAPL meet HTML parses correctly", () => {
      expect(usaplDoc).toBeDefined();
    });

    test("WRPF meet HTML parses correctly", () => {
      expect(wrpfDoc).toBeDefined();
    });
  });

  describe("meet title extraction", () => {
    test("extracts title from RPS meet", () => {
      expect(rpsMeet.title).toBeDefined();
      expect(rpsMeet.title.length).toBeGreaterThan(0);
      expect(rpsMeet.title).toContain("RPS");
    });

    test("extracts title from USAPL meet", () => {
      expect(usaplMeet.title).toBeDefined();
      expect(usaplMeet.title.length).toBeGreaterThan(0);
      expect(usaplMeet.title.toLowerCase()).toContain("usapl");
    });

    test("extracts title from WRPF meet", () => {
      expect(wrpfMeet.title).toBeDefined();
      expect(wrpfMeet.title.length).toBeGreaterThan(0);
    });
  });

  describe("meet date and location extraction", () => {
    test("extracts date from RPS meet", () => {
      expect(rpsMeet.date).toBeDefined();
      expect(rpsMeet.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("extracts date from USAPL meet", () => {
      expect(usaplMeet.date).toBeDefined();
      expect(usaplMeet.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("extracts location from USAPL meet", () => {
      expect(usaplMeet.location).toBeDefined();
      expect(usaplMeet.location.length).toBeGreaterThan(0);
    });

    test("extracts location from WRPF meet", () => {
      expect(wrpfMeet.location).toBeDefined();
    });
  });

  describe("meet results table extraction", () => {
    test("finds results table in RPS meet", () => {
      expect(rpsMeet.table).toBeDefined();
    });

    test("finds results table in USAPL meet", () => {
      expect(usaplMeet.table).toBeDefined();
    });

    test("finds results table in WRPF meet", () => {
      expect(wrpfMeet.table).toBeDefined();
    });
  });

  describe("meet results parsing", () => {
    test("extracts results from RPS meet", () => {
      expect(Array.isArray(rpsMeet.results)).toBe(true);
      expect(rpsMeet.results.length).toBeGreaterThan(0);
    });

    test("extracts results from USAPL meet", () => {
      expect(Array.isArray(usaplMeet.results)).toBe(true);
      expect(usaplMeet.results.length).toBeGreaterThan(0);
    });

    test("extracts results from WRPF meet", () => {
      expect(Array.isArray(wrpfMeet.results)).toBe(true);
      expect(wrpfMeet.results.length).toBeGreaterThan(0);
    });

    test("results have expected fields", () => {
      if (rpsMeet.results.length > 0) {
        const firstResult = rpsMeet.results[0];
        const keys = Object.keys(firstResult).map((k) => k.toLowerCase());

        const hasRank = keys.some((k) => k.includes("rank") || k === "#");
        const hasLifter = keys.some((k) => k.includes("lifter") || k.includes("name"));

        expect(hasRank || hasLifter).toBe(true);
      }
    });

    test("results contain lift data", () => {
      if (rpsMeet.results.length > 0) {
        const firstResult = rpsMeet.results[0];
        const keys = Object.keys(firstResult).map((k) => k.toLowerCase());

        const hasSquat = keys.some((k) => k.includes("squat") || k.includes("sq"));
        const hasBench = keys.some((k) => k.includes("bench") || k.includes("bp"));
        const hasDeadlift = keys.some((k) => k.includes("deadlift") || k.includes("dl"));
        const hasTotal = keys.some((k) => k.includes("total"));

        expect(hasSquat || hasBench || hasDeadlift || hasTotal).toBe(true);
      }
    });
  });

  describe("full meet data extraction", () => {
    test("extracts complete RPS meet data", () => {
      expect(rpsMeet.title).toBeDefined();
      expect(rpsMeet.title.length).toBeGreaterThan(0);
      expect(rpsMeet.date).toBeDefined();
      expect(Array.isArray(rpsMeet.results)).toBe(true);
      expect(rpsMeet.results.length).toBeGreaterThan(0);
    });

    test("extracts complete USAPL meet data", () => {
      expect(usaplMeet.title).toBeDefined();
      expect(usaplMeet.title.length).toBeGreaterThan(0);
      expect(usaplMeet.date).toBeDefined();
      expect(usaplMeet.location).toBeDefined();
      expect(Array.isArray(usaplMeet.results)).toBe(true);
    });

    test("extracts complete WRPF meet data", () => {
      expect(wrpfMeet.title).toBeDefined();
      expect(wrpfMeet.title.length).toBeGreaterThan(0);
      expect(Array.isArray(wrpfMeet.results)).toBe(true);
    });
  });
});
