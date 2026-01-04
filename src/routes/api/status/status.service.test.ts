import { describe, expect, test } from "vitest";

import { createContext } from "../../../context";
import { createStatusService } from "./status.service";
import { statusHtml } from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const statusService = createStatusService(scraper);

const statusDoc = scraper.parseHtml(statusHtml);
const statusData = statusService.parseStatusHtml(statusDoc);

describe("status service", () => {
  describe("parseStatusHtml", () => {
    it("parses status HTML correctly", () => {
      expect(statusData).toBeDefined();
    });

    it("returns StatusData structure", () => {
      expect(statusData).toHaveProperty("server_version");
      expect(statusData).toHaveProperty("meets");
      expect(statusData).toHaveProperty("federations");
    });

    it("extracts server version commit hash", () => {
      expect(statusData.server_version).toBeDefined();
      expect(statusData.server_version.length).toBeGreaterThan(0);
      expect(statusData.server_version).toMatch(/^[a-f0-9]+$/);
    });

    it("extracts meets info string", () => {
      expect(statusData.meets).toBeDefined();
      expect(statusData.meets.length).toBeGreaterThan(0);
      expect(statusData.meets).toContain("Tracking");
    });

    it("extracts federations array", () => {
      expect(Array.isArray(statusData.federations)).toBe(true);
      expect(statusData.federations.length).toBeGreaterThan(0);
    });

    it("federations have Name column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasName = keys.some((k) => k.toLowerCase().includes("name"));
        expect(hasName).toBe(true);
      }
    });

    it("federations have Status column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasStatus = keys.some((k) => k.toLowerCase().includes("status"));
        expect(hasStatus).toBe(true);
      }
    });

    it("federations have Meets column", () => {
      if (statusData.federations.length > 0) {
        const keys = Object.keys(statusData.federations[0]);
        const hasMeets = keys.some((k) => k.toLowerCase().includes("meets"));
        expect(hasMeets).toBe(true);
      }
    });
  });
});
