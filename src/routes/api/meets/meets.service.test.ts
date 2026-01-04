import { describe, expect, test } from "vitest";

import { createContext } from "../../../context";
import { createMeetService } from "./meets.service";
import {
  meetRps2548Html,
  meetUsaplIsr2025Html,
  meetWrpfUsa23e1Html,
  meetUspa1969Html,
} from "./fixtures";

const context = createContext();
const scraper = context.scraper;
const meetService = createMeetService(scraper);

const rpsDoc = scraper.parseHtml(meetRps2548Html);
const usaplDoc = scraper.parseHtml(meetUsaplIsr2025Html);
const wrpfDoc = scraper.parseHtml(meetWrpfUsa23e1Html);
const uspaDoc = scraper.parseHtml(meetUspa1969Html);

const rpsMeet = meetService.parseMeetHtml(rpsDoc);
const usaplMeet = meetService.parseMeetHtml(usaplDoc);
const wrpfMeet = meetService.parseMeetHtml(wrpfDoc);
const uspaMeet = meetService.parseMeetHtml(uspaDoc);

describe("meets service", () => {
  describe("parseMeetHtml", () => {
    it("parses RPS meet HTML correctly", () => {
      expect(rpsMeet).toBeDefined();
      expect(rpsMeet.title).toBeDefined();
      expect(rpsMeet.date).toBeDefined();
      expect(rpsMeet.location).toBeDefined();
      expect(rpsMeet.results).toBeDefined();
    });

    it("parses USAPL meet HTML correctly", () => {
      expect(usaplMeet).toBeDefined();
      expect(usaplMeet.title).toBeDefined();
      expect(usaplMeet.date).toBeDefined();
      expect(usaplMeet.location).toBeDefined();
      expect(usaplMeet.results).toBeDefined();
    });

    it("parses WRPF meet HTML correctly", () => {
      expect(wrpfMeet).toBeDefined();
      expect(wrpfMeet.title).toBeDefined();
      expect(wrpfMeet.results).toBeDefined();
    });

    it("parses USPA meet HTML correctly", () => {
      expect(uspaMeet).toBeDefined();
      expect(uspaMeet.title).toBeDefined();
      expect(uspaMeet.date).toBeDefined();
      expect(uspaMeet.location).toBeDefined();
      expect(uspaMeet.results).toBeDefined();
    });

    it("extracts title from RPS meet", () => {
      expect(rpsMeet.title.length).toBeGreaterThan(0);
      expect(rpsMeet.title).toContain("RPS");
    });

    it("extracts title from USAPL meet", () => {
      expect(usaplMeet.title.length).toBeGreaterThan(0);
      expect(usaplMeet.title.toLowerCase()).toContain("usapl");
    });

    it("extracts title from WRPF meet", () => {
      expect(wrpfMeet.title.length).toBeGreaterThan(0);
    });

    it("extracts title from USPA meet", () => {
      expect(uspaMeet.title.length).toBeGreaterThan(0);
      expect(uspaMeet.title.toLowerCase()).toContain("uspa");
    });

    it("extracts date in correct format from RPS meet", () => {
      expect(rpsMeet.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("extracts date in correct format from USAPL meet", () => {
      expect(usaplMeet.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("extracts date in correct format from USPA meet", () => {
      expect(uspaMeet.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("extracts location from USAPL meet", () => {
      expect(usaplMeet.location.length).toBeGreaterThan(0);
    });

    it("extracts location from USPA meet", () => {
      expect(uspaMeet.location.length).toBeGreaterThan(0);
    });

    it("extracts results from RPS meet", () => {
      expect(Array.isArray(rpsMeet.results)).toBe(true);
      expect(rpsMeet.results.length).toBeGreaterThan(0);
    });

    it("extracts results from USAPL meet", () => {
      expect(Array.isArray(usaplMeet.results)).toBe(true);
      expect(usaplMeet.results.length).toBeGreaterThan(0);
    });

    it("extracts results from WRPF meet", () => {
      expect(Array.isArray(wrpfMeet.results)).toBe(true);
      expect(wrpfMeet.results.length).toBeGreaterThan(0);
    });

    it("extracts results from USPA meet", () => {
      expect(Array.isArray(uspaMeet.results)).toBe(true);
      expect(uspaMeet.results.length).toBeGreaterThan(0);
    });

    it("results have expected fields", () => {
      if (rpsMeet.results.length > 0) {
        const firstResult = rpsMeet.results[0];
        const keys = Object.keys(firstResult).map((k) => k.toLowerCase());
        const hasRank = keys.some((k) => k.includes("rank") || k === "#");
        const hasLifter = keys.some((k) => k.includes("lifter") || k.includes("name"));
        expect(hasRank || hasLifter).toBe(true);
      }
    });

    it("results contain lift data", () => {
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
});
