import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createMeetsService } from "./meets.service";

function service() {
  return createMeetsService(createTestContext().store);
}

describe("meets service", () => {
  describe("listMeets", () => {
    it("sorts meets by date desc by default and reports pagination", async () => {
      const { data, pagination } = await service().listMeets({});
      expect(pagination.items).toBe(3);
      expect(data).toHaveLength(3);
      expect((data[0] as { date: string }).date).toBe("2024-09-01");
    });

    it("filters by federation slug", async () => {
      const { data } = await service().listMeets({ federation: "wrpf" });
      expect(data).toHaveLength(1);
    });

    it("filters by date range", async () => {
      const { data } = await service().listMeets({ from: "2024-01-01", to: "2024-12-31" });
      expect(data).toHaveLength(2);
    });

    it("supports date-asc sort", async () => {
      const { data } = await service().listMeets({ sort: "date-asc" });
      expect((data[0] as { date: string }).date).toBe("2023-11-15");
    });
  });

  describe("getMeet", () => {
    it("returns meet detail for a known path", async () => {
      const result = await service().getMeet(
        { federation: "wrpf", date: "2024-05-12", slug: "wrpfamericanpro" },
        {},
      );
      expect(result).not.toBeNull();
      expect((result as { meet_name: string }).meet_name).toBe("WRPF AMERICAN PRO");
    });

    it("returns null for an unknown path", async () => {
      const result = await service().getMeet(
        { federation: "wrpf", date: "9999-01-01", slug: "ghost" },
        {},
      );
      expect(result).toBeNull();
    });
  });

  describe("getMeetHighlights", () => {
    it("emits best-of for total / squat / bench / deadlift / dots", async () => {
      const result = await service().getMeetHighlights(
        { federation: "wrpf", date: "2024-05-12", slug: "wrpfamericanpro" },
        { units: "kg" },
      );
      expect(result).not.toBeNull();
      const highlights = (result as { highlights: Record<string, { value: number }> }).highlights;
      expect(highlights.best_total!.value).toBe(1080);
      expect(highlights.best_squat!.value).toBe(410);
    });

    it("returns null for an unknown path", async () => {
      const result = await service().getMeetHighlights(
        { federation: "wrpf", date: "9999-01-01", slug: "ghost" },
        {},
      );
      expect(result).toBeNull();
    });
  });
});
