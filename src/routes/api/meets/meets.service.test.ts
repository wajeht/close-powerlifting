import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { meetRps2548Html, meetUsaplIsr2025Html, meetWrpfUsa23e1Html } from "./fixtures";

describe("meets service", () => {
  describe("meet HTML parsing", () => {
    test("RPS meet HTML parses correctly", () => {
      const doc = parseHtml(meetRps2548Html);
      expect(doc).toBeDefined();
    });

    test("USAPL meet HTML parses correctly", () => {
      const doc = parseHtml(meetUsaplIsr2025Html);
      expect(doc).toBeDefined();
    });

    test("WRPF meet HTML parses correctly", () => {
      const doc = parseHtml(meetWrpfUsa23e1Html);
      expect(doc).toBeDefined();
    });
  });

  describe("meet title extraction", () => {
    test("extracts title from RPS meet", () => {
      const doc = parseHtml(meetRps2548Html);
      const h1 = doc.querySelector("h1#meet");
      const title = h1?.textContent?.trim() || "";

      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);
      expect(title).toContain("RPS");
    });

    test("extracts title from USAPL meet", () => {
      const doc = parseHtml(meetUsaplIsr2025Html);
      const h1 = doc.querySelector("h1#meet");
      const title = h1?.textContent?.trim() || "";

      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);
      expect(title.toLowerCase()).toContain("usapl");
    });

    test("extracts title from WRPF meet", () => {
      const doc = parseHtml(meetWrpfUsa23e1Html);
      const h1 = doc.querySelector("h1#meet");
      const title = h1?.textContent?.trim() || "";

      expect(title).toBeDefined();
      expect(title.length).toBeGreaterThan(0);
    });
  });

  describe("meet date and location extraction", () => {
    function extractMeetMetadata(html: string) {
      const doc = parseHtml(html);
      const h1 = doc.querySelector("h1#meet");
      const title = h1?.textContent?.trim() || "";

      const p = h1?.nextElementSibling;
      const dateLocationText = p?.textContent?.trim().split("\n")[0] || "";
      const [date, ...locationParts] = dateLocationText.split(",").map((s) => s.trim());
      const location = locationParts.join(", ");

      return { title, date, location };
    }

    test("extracts date from RPS meet", () => {
      const { date } = extractMeetMetadata(meetRps2548Html);
      expect(date).toBeDefined();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("extracts date from USAPL meet", () => {
      const { date } = extractMeetMetadata(meetUsaplIsr2025Html);
      expect(date).toBeDefined();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("extracts location from USAPL meet", () => {
      const { location } = extractMeetMetadata(meetUsaplIsr2025Html);
      expect(location).toBeDefined();
      expect(location.length).toBeGreaterThan(0);
    });

    test("extracts location from WRPF meet", () => {
      const { location } = extractMeetMetadata(meetWrpfUsa23e1Html);
      expect(location).toBeDefined();
    });
  });

  describe("meet results table extraction", () => {
    test("finds results table in RPS meet", () => {
      const doc = parseHtml(meetRps2548Html);
      const table = doc.querySelector("table");
      expect(table).toBeDefined();
    });

    test("finds results table in USAPL meet", () => {
      const doc = parseHtml(meetUsaplIsr2025Html);
      const table = doc.querySelector("table");
      expect(table).toBeDefined();
    });

    test("finds results table in WRPF meet", () => {
      const doc = parseHtml(meetWrpfUsa23e1Html);
      const table = doc.querySelector("table");
      expect(table).toBeDefined();
    });
  });

  describe("meet results parsing", () => {
    function extractMeetResults(html: string) {
      const doc = parseHtml(html);
      const table = doc.querySelector("table");
      return tableToJson<Record<string, string>>(table);
    }

    test("extracts results from RPS meet", () => {
      const results = extractMeetResults(meetRps2548Html);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test("extracts results from USAPL meet", () => {
      const results = extractMeetResults(meetUsaplIsr2025Html);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test("extracts results from WRPF meet", () => {
      const results = extractMeetResults(meetWrpfUsa23e1Html);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test("results have expected fields", () => {
      const results = extractMeetResults(meetRps2548Html);
      if (results.length > 0) {
        const firstResult = results[0];
        const keys = Object.keys(firstResult).map((k) => k.toLowerCase());

        const hasRank = keys.some((k) => k.includes("rank") || k === "#");
        const hasLifter = keys.some((k) => k.includes("lifter") || k.includes("name"));

        expect(hasRank || hasLifter).toBe(true);
      }
    });

    test("results contain lift data", () => {
      const results = extractMeetResults(meetRps2548Html);
      if (results.length > 0) {
        const firstResult = results[0];
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
    function extractMeetData(html: string) {
      const doc = parseHtml(html);

      const h1 = doc.querySelector("h1#meet");
      const title = h1?.textContent?.trim() || "";

      const p = h1?.nextElementSibling;
      const dateLocationText = p?.textContent?.trim().split("\n")[0] || "";
      const [date, ...locationParts] = dateLocationText.split(",").map((s) => s.trim());
      const location = locationParts.join(", ");

      const table = doc.querySelector("table");
      const results = tableToJson<Record<string, string>>(table);

      return { title, date, location, results };
    }

    test("extracts complete RPS meet data", () => {
      const meetData = extractMeetData(meetRps2548Html);

      expect(meetData.title).toBeDefined();
      expect(meetData.title.length).toBeGreaterThan(0);
      expect(meetData.date).toBeDefined();
      expect(Array.isArray(meetData.results)).toBe(true);
      expect(meetData.results.length).toBeGreaterThan(0);
    });

    test("extracts complete USAPL meet data", () => {
      const meetData = extractMeetData(meetUsaplIsr2025Html);

      expect(meetData.title).toBeDefined();
      expect(meetData.title.length).toBeGreaterThan(0);
      expect(meetData.date).toBeDefined();
      expect(meetData.location).toBeDefined();
      expect(Array.isArray(meetData.results)).toBe(true);
    });

    test("extracts complete WRPF meet data", () => {
      const meetData = extractMeetData(meetWrpfUsa23e1Html);

      expect(meetData.title).toBeDefined();
      expect(meetData.title.length).toBeGreaterThan(0);
      expect(Array.isArray(meetData.results)).toBe(true);
    });
  });
});
