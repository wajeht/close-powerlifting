import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { statusHtml } from "./fixtures";

describe("status service", () => {
  describe("status HTML parsing", () => {
    test("status HTML parses correctly", () => {
      const doc = parseHtml(statusHtml);
      expect(doc).toBeDefined();
    });
  });

  describe("status page structure", () => {
    test("has Status h1 heading", () => {
      const doc = parseHtml(statusHtml);
      const h1 = doc.querySelector("h1");
      expect(h1).toBeDefined();
      expect(h1?.textContent?.trim()).toBe("Status");
    });

    test("has Server Version section", () => {
      const doc = parseHtml(statusHtml);
      const h2s = doc.querySelectorAll("h2");
      const texts = Array.from(h2s).map((h) => h.textContent?.trim());
      expect(texts).toContain("Server Version");
    });

    test("has Meets section", () => {
      const doc = parseHtml(statusHtml);
      const h2s = doc.querySelectorAll("h2");
      const texts = Array.from(h2s).map((h) => h.textContent?.trim());
      expect(texts).toContain("Meets");
    });

    test("has Federations section", () => {
      const doc = parseHtml(statusHtml);
      const h2s = doc.querySelectorAll("h2");
      const texts = Array.from(h2s).map((h) => h.textContent?.trim());
      expect(texts).toContain("Federations");
    });
  });

  describe("server version extraction", () => {
    function extractServerVersion(html: string) {
      const doc = parseHtml(html);
      const h2s = doc.querySelectorAll("h2");

      for (const h2 of h2s) {
        if (h2.textContent?.includes("Server Version")) {
          const p = h2.nextElementSibling;
          const link = p?.querySelector("a");
          const href = link?.getAttribute("href") || "";
          const match = href.match(/commits\/([a-f0-9]+)/);
          return match ? match[1] : "";
        }
      }
      return "";
    }

    test("extracts server version commit hash", () => {
      const version = extractServerVersion(statusHtml);
      expect(version).toBeDefined();
      expect(version.length).toBeGreaterThan(0);
      expect(version).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("meets statistics extraction", () => {
    function extractMeetsStats(html: string) {
      const doc = parseHtml(html);
      const content = doc.querySelector(".text-content");
      const text = content?.textContent || "";

      const entriesMatch = text.match(/(\d[\d,]*)\s+entries/);
      const liftersMatch = text.match(/(\d[\d,]*)\s+lifters/);
      const meetsMatch = text.match(/(\d[\d,]*)\s+meets/);

      return {
        entries: entriesMatch ? parseInt(entriesMatch[1].replace(/,/g, ""), 10) : 0,
        lifters: liftersMatch ? parseInt(liftersMatch[1].replace(/,/g, ""), 10) : 0,
        meets: meetsMatch ? parseInt(meetsMatch[1].replace(/,/g, ""), 10) : 0,
      };
    }

    test("extracts entries count", () => {
      const stats = extractMeetsStats(statusHtml);
      expect(stats.entries).toBeGreaterThan(0);
    });

    test("extracts lifters count", () => {
      const stats = extractMeetsStats(statusHtml);
      expect(stats.lifters).toBeGreaterThan(0);
    });

    test("extracts meets count", () => {
      const stats = extractMeetsStats(statusHtml);
      expect(stats.meets).toBeGreaterThan(0);
    });
  });

  describe("federations table extraction", () => {
    function extractFederationsTable(html: string) {
      const doc = parseHtml(html);
      const h2s = doc.querySelectorAll("h2");

      for (const h2 of h2s) {
        if (h2.textContent?.includes("Federations")) {
          const table = h2.nextElementSibling;
          if (table?.tagName === "TABLE") {
            return tableToJson<Record<string, string>>(table);
          }
        }
      }
      return [];
    }

    test("extracts federations table", () => {
      const federations = extractFederationsTable(statusHtml);
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
    });

    test("federations have Name column", () => {
      const federations = extractFederationsTable(statusHtml);
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasName = keys.some((k) => k.toLowerCase().includes("name"));
        expect(hasName).toBe(true);
      }
    });

    test("federations have Status column", () => {
      const federations = extractFederationsTable(statusHtml);
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasStatus = keys.some((k) => k.toLowerCase().includes("status"));
        expect(hasStatus).toBe(true);
      }
    });

    test("federations have Meets Entered column", () => {
      const federations = extractFederationsTable(statusHtml);
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasMeets = keys.some((k) => k.toLowerCase().includes("meets"));
        expect(hasMeets).toBe(true);
      }
    });
  });

  describe("full status data extraction", () => {
    function extractStatusData(html: string) {
      const doc = parseHtml(html);

      // Server version
      let serverVersion = "";
      const h2s = doc.querySelectorAll("h2");
      for (const h2 of h2s) {
        if (h2.textContent?.includes("Server Version")) {
          const p = h2.nextElementSibling;
          const link = p?.querySelector("a");
          const href = link?.getAttribute("href") || "";
          const match = href.match(/commits\/([a-f0-9]+)/);
          serverVersion = match ? match[1] : "";
          break;
        }
      }

      // Meets stats
      const content = doc.querySelector(".text-content");
      const text = content?.textContent || "";
      const entriesMatch = text.match(/(\d[\d,]*)\s+entries/);
      const liftersMatch = text.match(/(\d[\d,]*)\s+lifters/);
      const meetsMatch = text.match(/(\d[\d,]*)\s+meets/);

      // Federations
      let federations: Record<string, string>[] = [];
      for (const h2 of h2s) {
        if (h2.textContent?.includes("Federations")) {
          const table = h2.nextElementSibling;
          if (table?.tagName === "TABLE") {
            federations = tableToJson<Record<string, string>>(table);
          }
          break;
        }
      }

      return {
        serverVersion,
        stats: {
          entries: entriesMatch ? parseInt(entriesMatch[1].replace(/,/g, ""), 10) : 0,
          lifters: liftersMatch ? parseInt(liftersMatch[1].replace(/,/g, ""), 10) : 0,
          meets: meetsMatch ? parseInt(meetsMatch[1].replace(/,/g, ""), 10) : 0,
        },
        federations,
      };
    }

    test("extracts complete status data", () => {
      const statusData = extractStatusData(statusHtml);

      expect(statusData.serverVersion).toBeDefined();
      expect(statusData.serverVersion.length).toBeGreaterThan(0);
      expect(statusData.stats.entries).toBeGreaterThan(0);
      expect(statusData.stats.lifters).toBeGreaterThan(0);
      expect(statusData.stats.meets).toBeGreaterThan(0);
      expect(Array.isArray(statusData.federations)).toBe(true);
      expect(statusData.federations.length).toBeGreaterThan(0);
    });
  });
});
