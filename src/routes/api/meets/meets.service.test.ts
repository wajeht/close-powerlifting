import { describe, expect, it, vi } from "vite-plus/test";

import { createContext } from "../../../context";
import { createMeetService, buildMeetHighlights } from "./meets.service";
import type { MeetData } from "../../../types";

const context = createContext();
const scraper = context.scraper;
const meetService = createMeetService(context.knex, scraper);

const sampleMeet: MeetData = {
  title: "Test Pro",
  date: "2024-05-12",
  location: "USA-CA",
  results: [
    {
      rank: "1",
      lifter: "Alice",
      sex: "F",
      age: "28",
      equip: "Raw",
      class: "75",
      weight: "74",
      squat: "230",
      bench: "130",
      deadlift: "240",
      total: "600",
      dots: "612.3",
    },
    {
      rank: "2",
      lifter: "Bob",
      sex: "M",
      age: "30",
      equip: "Raw",
      class: "100",
      weight: "99",
      squat: "360",
      bench: "240",
      deadlift: "400",
      total: "1000",
      dots: "605.0",
    },
    {
      rank: "3",
      lifter: "Carol",
      sex: "F",
      age: "25",
      equip: "Raw",
      class: "75",
      weight: "73",
      squat: "210",
      bench: "120",
      deadlift: "230",
      total: "560",
      dots: "580.0",
    },
  ],
};

describe("meets service", () => {
  describe("buildMeetHighlights", () => {
    it("returns the meet metadata", () => {
      const highlights = buildMeetHighlights(sampleMeet);
      expect(highlights.title).toBe("Test Pro");
      expect(highlights.date).toBe("2024-05-12");
      expect(highlights.location).toBe("USA-CA");
      expect(highlights.total_lifters).toBe(3);
    });

    it("returns top 3 by dots and by total", () => {
      const highlights = buildMeetHighlights(sampleMeet);
      expect(highlights.top_by_dots).toHaveLength(3);
      expect(highlights.top_by_total).toHaveLength(3);
      expect(highlights.top_by_dots[0]!.name).toBe("Alice");
      expect(highlights.top_by_total[0]!.name).toBe("Bob");
    });

    it("collects distinct weight classes contested", () => {
      const highlights = buildMeetHighlights(sampleMeet);
      expect(highlights.weight_classes_contested).toEqual(["100", "75"]);
    });
  });

  describe("parseMeetCacheKey", () => {
    it("returns null for non-meet keys", () => {
      expect(meetService.parseMeetCacheKey("status")).toBeNull();
      expect(meetService.parseMeetCacheKey("user-johnhaack-lbs")).toBeNull();
    });

    it("parses base meet key", () => {
      expect(meetService.parseMeetCacheKey("meet-uspa/1969")).toEqual({
        path: "uspa/1969",
        isHighlights: false,
      });
    });

    it("parses meet key with units", () => {
      expect(meetService.parseMeetCacheKey("meet-uspa/1969-kg")).toEqual({
        path: "uspa/1969",
        units: "kg",
        isHighlights: false,
      });
    });

    it("parses meet key with sort", () => {
      expect(meetService.parseMeetCacheKey("meet-uspa/1969-by-wilks")).toEqual({
        path: "uspa/1969",
        sort: "by-wilks",
        isHighlights: false,
      });
    });

    it("parses meet highlights key", () => {
      expect(meetService.parseMeetCacheKey("meet-uspa/1969-highlights")).toEqual({
        path: "uspa/1969",
        isHighlights: true,
      });
    });
  });

  describe("getMeet (DB-backed)", () => {
    it("returns null for paths that do not parse", async () => {
      const result = await meetService.getMeet({ meet: "garbage" });
      expect(result.data).toBeNull();
    });

    it("returns null when no lifts match", async () => {
      const result = await meetService.getMeet({ meet: "fake/2024-01-01/missing-meet" });
      expect(result.data).toBeNull();
    });
  });
});

describe("meets service refreshCacheKey", () => {
  it("returns false for non-meet keys", async () => {
    expect(await meetService.refreshCacheKey("status")).toBe(false);
  });

  it("returns true for meet keys without re-scraping (lifts now)", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache");
    const result = await meetService.refreshCacheKey("meet-uspa/1969");
    expect(result).toBe(true);
    expect(refreshSpy).not.toHaveBeenCalled();
    refreshSpy.mockRestore();
  });

  it("returns true for highlights keys", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache");
    const result = await meetService.refreshCacheKey("meet-uspa/1969-highlights");
    expect(result).toBe(true);
    expect(refreshSpy).not.toHaveBeenCalled();
    refreshSpy.mockRestore();
  });
});
