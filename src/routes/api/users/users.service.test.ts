import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createUsersService } from "./users.service";

function service() {
  return createUsersService(createTestContext().store);
}

describe("users service", () => {
  describe("listLifters", () => {
    it("returns every lifter paginated when no search term is given", () => {
      const result = service().listLifters({});
      expect(result.pagination.items).toBe(5);
      expect(result.data).toHaveLength(5);
    });

    it("returns search matches with pagination", () => {
      const result = service().listLifters({ search: "Coan" });
      expect(result.pagination).not.toBeUndefined();
      expect(result.data).toContainEqual({
        username: "edcoan",
        name: "Ed Coan",
      });
    });

    it("honours current_page + per_page", () => {
      const result = service().listLifters({ per_page: 2, current_page: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.current_page).toBe(2);
      expect(result.pagination.per_page).toBe(2);
    });
  });

  describe("getUser", () => {
    it("returns the profile + competition history", () => {
      const data = service().getUser("edcoan", { units: "kg" });
      expect(data).not.toBeNull();
      expect((data as { total_entries: number }).total_entries).toBe(2);
    });

    it("returns null for an unknown lifter", () => {
      expect(service().getUser("nobody", {})).toBeNull();
    });
  });

  describe("getProgression", () => {
    it("returns chronological entries with running PB", () => {
      const data = service().getProgression("edcoan", "kg");
      expect(data).not.toBeNull();
      const list = (data as { progression: Array<{ date: string }> }).progression;
      expect(list).toHaveLength(2);
      expect(list[0]!.date).toBe("2024-05-12");
    });

    it("returns null for an unknown lifter", () => {
      expect(service().getProgression("nobody", "kg")).toBeNull();
    });
  });

  describe("getPersonalBests", () => {
    it("groups PBs by equipment", () => {
      const data = service().getPersonalBests("edcoan", "kg");
      expect(data).not.toBeNull();
      const groups = (data as { by_equipment: Array<{ equipment: string }> }).by_equipment;
      expect(groups.find((g) => g.equipment === "Raw")).not.toBeUndefined();
    });
  });

  describe("getRank", () => {
    it("emits a rank per metric", () => {
      const data = service().getRank("edcoan");
      expect(data).not.toBeNull();
      const ranks = (data as { ranks: Record<string, { rank: number; out_of: number } | null> })
        .ranks;
      expect(ranks.dots!.rank).toBe(1);
    });
  });

  describe("compare", () => {
    it("returns deltas between two known lifters", () => {
      const result = service().compare({ a: "edcoan", b: "johnsmith1", units: "kg" });
      expect(result.found).toBe(true);
      if (result.found) {
        const data = result.data as { deltas: { total: number } };
        expect(data.deltas.total).toBe(110);
      }
    });

    it("reports which side is missing when one lifter does not exist", () => {
      const result = service().compare({ a: "edcoan", b: "nobody" });
      expect(result.found).toBe(false);
      if (!result.found) expect(result.missing).toBe("b");
    });
  });
});
