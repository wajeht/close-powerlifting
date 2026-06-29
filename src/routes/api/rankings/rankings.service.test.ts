import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createRankingsService } from "./rankings.service";

function service() {
  return createRankingsService(createTestContext().store);
}

describe("rankings service", () => {
  describe("getRankings", () => {
    it("returns lifters sorted by dots desc with pagination", async () => {
      const { data, pagination } = await service().getRankings({ per_page: 2, units: "kg" });
      expect(pagination.items).toBe(5);
      expect(data).toHaveLength(2);
      expect((data[0] as { rank: number; username: string }).rank).toBe(1);
      expect((data[0] as { username: string }).username).toBe("edcoan");
    });

    it("respects current_page", async () => {
      const { data } = await service().getRankings({
        per_page: 1,
        current_page: 3,
        units: "kg",
      });
      expect((data[0] as { rank: number }).rank).toBe(3);
    });
  });

  describe("getFilteredRankings", () => {
    it("uses broad equipment filters without extra constraints", async () => {
      const { data } = await service().getFilteredRankings({ equipment: "raw" }, { units: "kg" });
      const usernames = data.map((r) => (r as { username: string }).username);
      expect(usernames).toContain("edcoan");
      expect(usernames).toContain("kristyhawkins");
      expect(usernames).not.toContain("johnsmith1");
    });

    it("filters by equipment + sex", async () => {
      const { data } = await service().getFilteredRankings(
        { equipment: "raw", sex: "men" },
        { units: "kg" },
      );
      const usernames = data.map((r) => (r as { username: string }).username);
      expect(usernames).toContain("edcoan");
      expect(usernames).not.toContain("johnsmith1");
    });

    it("supports custom sort metric on the deepest filter", async () => {
      const { data } = await service().getFilteredRankings(
        {
          equipment: "raw",
          sex: "men",
          weight_class: "100",
          year: "2024",
          event: "full-power",
          sort: "by-total",
        },
        { units: "kg" },
      );
      expect((data[0] as { username: string }).username).toBe("edcoan");
    });

    it("returns an empty data array when no entry matches", async () => {
      const { data } = await service().getFilteredRankings({ equipment: "raw", year: "1900" }, {});
      expect(data).toHaveLength(0);
    });
  });

  describe("getRank", () => {
    it("returns the lifter at the requested rank", async () => {
      const data = await service().getRank(1);
      expect(data).not.toBeNull();
      expect((data as { username: string }).username).toBe("edcoan");
    });

    it("returns null when the rank is out of range", async () => {
      await expect(service().getRank(9999)).resolves.toBeNull();
    });
  });

  describe("getMaxRank", () => {
    it("matches the size of the dots ranking", async () => {
      await expect(service().getMaxRank()).resolves.toBe(5);
    });
  });
});
