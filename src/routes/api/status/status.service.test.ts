import { describe, expect, test } from "vitest";

import { Scraper } from "../../../utils/scraper";
import { StatusService } from "./status.service";
import { statusHtml } from "./fixtures";

const scraper = Scraper();
const statusService = StatusService();

const statusDoc = scraper.parseHtml(statusHtml);
const statusData = statusService.parseStatusHtml(statusDoc);

describe("status service", () => {
  describe("parseStatusHtml", () => {
    test("parses status HTML correctly", () => {
      expect(statusData).toBeDefined();
    });

    test("returns StatusData structure", () => {
      expect(statusData).toHaveProperty("server_version");
      expect(statusData).toHaveProperty("meets");
      expect(statusData).toHaveProperty("federations");
    });

    test("extracts server version commit hash", () => {
      expect(statusData.server_version).toBeDefined();
      expect(statusData.server_version.length).toBeGreaterThan(0);
      expect(statusData.server_version).toMatch(/^[a-f0-9]+$/);
    });

    test("extracts meets info string", () => {
      expect(statusData.meets).toBeDefined();
      expect(statusData.meets.length).toBeGreaterThan(0);
      expect(statusData.meets).toContain("Tracking");
    });

    test("extracts federations array", () => {
      expect(Array.isArray(statusData.federations)).toBe(true);
      expect(statusData.federations.length).toBeGreaterThan(0);
    });

    test("federations have Name column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasName = keys.some((k) => k.toLowerCase().includes("name"));
        expect(hasName).toBe(true);
      }
    });

    test("federations have Status column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasStatus = keys.some((k) => k.toLowerCase().includes("status"));
        expect(hasStatus).toBe(true);
      }
    });

    test("federations have Meets column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasMeets = keys.some((k) => k.toLowerCase().includes("meets"));
        expect(hasMeets).toBe(true);
      }
    });
  });
});
