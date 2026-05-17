import { describe, expect, it } from "vite-plus/test";

import { createContext } from "../../../context";
import { createMeetService, buildMeetHighlights } from "./meets.service";
import type { MeetData } from "../../../types";

const context = createContext();
const meetService = createMeetService(context.knex);

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
