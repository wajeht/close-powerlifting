import { describe, expect, test } from "vitest";

import { parseHtml, tableToJson } from "../../../utils/scraper";
import { statusHtml } from "./fixtures";

const statusDoc = parseHtml(statusHtml);
const h1 = statusDoc.querySelector("h1");
const h2s = statusDoc.querySelectorAll("h2");
const h2Texts = Array.from(h2s).map((h) => h.textContent?.trim());
const textContent = statusDoc.querySelector(".text-content");

function getServerVersion() {
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

function getMeetsStats() {
  const text = textContent?.textContent || "";
  const entriesMatch = text.match(/(\d[\d,]*)\s+entries/);
  const liftersMatch = text.match(/(\d[\d,]*)\s+lifters/);
  const meetsMatch = text.match(/(\d[\d,]*)\s+meets/);

  return {
    entries: entriesMatch ? parseInt(entriesMatch[1].replace(/,/g, ""), 10) : 0,
    lifters: liftersMatch ? parseInt(liftersMatch[1].replace(/,/g, ""), 10) : 0,
    meets: meetsMatch ? parseInt(meetsMatch[1].replace(/,/g, ""), 10) : 0,
  };
}

function getFederationsTable() {
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

const serverVersion = getServerVersion();
const meetsStats = getMeetsStats();
const federations = getFederationsTable();

describe("status service", () => {
  describe("status HTML parsing", () => {
    test("status HTML parses correctly", () => {
      expect(statusDoc).toBeDefined();
    });
  });

  describe("status page structure", () => {
    test("has Status h1 heading", () => {
      expect(h1).toBeDefined();
      expect(h1?.textContent?.trim()).toBe("Status");
    });

    test("has Server Version section", () => {
      expect(h2Texts).toContain("Server Version");
    });

    test("has Meets section", () => {
      expect(h2Texts).toContain("Meets");
    });

    test("has Federations section", () => {
      expect(h2Texts).toContain("Federations");
    });
  });

  describe("server version extraction", () => {
    test("extracts server version commit hash", () => {
      expect(serverVersion).toBeDefined();
      expect(serverVersion.length).toBeGreaterThan(0);
      expect(serverVersion).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe("meets statistics extraction", () => {
    test("extracts entries count", () => {
      expect(meetsStats.entries).toBeGreaterThan(0);
    });

    test("extracts lifters count", () => {
      expect(meetsStats.lifters).toBeGreaterThan(0);
    });

    test("extracts meets count", () => {
      expect(meetsStats.meets).toBeGreaterThan(0);
    });
  });

  describe("federations table extraction", () => {
    test("extracts federations table", () => {
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
    });

    test("federations have Name column", () => {
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasName = keys.some((k) => k.toLowerCase().includes("name"));
        expect(hasName).toBe(true);
      }
    });

    test("federations have Status column", () => {
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasStatus = keys.some((k) => k.toLowerCase().includes("status"));
        expect(hasStatus).toBe(true);
      }
    });

    test("federations have Meets Entered column", () => {
      if (federations.length > 0) {
        const keys = Object.keys(federations[0]);
        const hasMeets = keys.some((k) => k.toLowerCase().includes("meets"));
        expect(hasMeets).toBe(true);
      }
    });
  });

  describe("full status data extraction", () => {
    test("extracts complete status data", () => {
      expect(serverVersion).toBeDefined();
      expect(serverVersion.length).toBeGreaterThan(0);
      expect(meetsStats.entries).toBeGreaterThan(0);
      expect(meetsStats.lifters).toBeGreaterThan(0);
      expect(meetsStats.meets).toBeGreaterThan(0);
      expect(Array.isArray(federations)).toBe(true);
      expect(federations.length).toBeGreaterThan(0);
    });
  });
});
