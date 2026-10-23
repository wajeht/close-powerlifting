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
      expect(pagination.items).toBe(6);
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

    it("filters by equipment without requiring a sex filter", async () => {
      const { data, pagination } = await service().getRankings({ equipment: "raw" });

      expect(pagination.items).toBe(5);
      expect(data).toMatchObject([
        { username: "edcoan" },
        { username: "marisrazmanis" },
        { username: "kristyhawkins" },
        { username: "ruthrabbitt" },
        { name: "山田太郎" },
      ]);
    });

    it("filters by sex without requiring an equipment filter", async () => {
      const { data, pagination } = await service().getRankings({ sex: "women" });

      expect(pagination.items).toBe(3);
      expect(data).toMatchObject([
        { username: "kristyhawkins" },
        { username: "ruthrabbitt" },
        { name: "山田太郎" },
      ]);
    });

    it("uses the requested global metric when sort is the only filter", async () => {
      const rankings = service();
      const totals = await rankings.getRankings({ sort: "by-total", units: "kg" });
      const squats = await rankings.getRankings({ sort: "by-squat", units: "kg" });

      expect(totals.data.slice(0, 3)).toMatchObject([
        { username: "edcoan", total: 1080 },
        { username: "johnsmith1", total: 970 },
        { username: "marisrazmanis", total: 965 },
      ]);
      expect(squats.data.slice(0, 3)).toMatchObject([
        { username: "edcoan", squat: 410 },
        { username: "marisrazmanis", squat: 365 },
        { username: "johnsmith1", squat: 360 },
      ]);
    });

    it("matches athlete country case-insensitively and excludes unknown countries", async () => {
      const { data, pagination } = await service().getRankings({ country: "uSa" });

      expect(pagination.items).toBe(4);
      expect(data).toMatchObject([
        { username: "edcoan", country: "USA" },
        { username: "johnsmith1", country: "USA" },
        { username: "kristyhawkins", country: "USA" },
        { username: "ruthrabbitt", country: "USA" },
      ]);
    });

    it.each(["Can", "%", "Canada' OR 1=1 --"])(
      "treats country %s as an exact bound value",
      async (country) => {
        const { data, pagination } = await service().getRankings({ country });

        expect(data).toEqual([]);
        expect(pagination.items).toBe(0);
      },
    );

    it("selects each athlete's best matching entry after country filtering", async () => {
      const { data, pagination } = await service().getRankings({
        country: "Canada",
        units: "kg",
      });

      expect(pagination.items).toBe(1);
      expect(data).toMatchObject([
        {
          username: "edcoan",
          country: "Canada",
          dots: 685,
          total: 1055,
          meet_date: "2024-09-01",
        },
      ]);
    });

    it("selects each athlete's best matching tested entry", async () => {
      const { data, pagination } = await service().getRankings({ tested: true });

      expect(pagination.items).toBe(2);
      expect(data).toMatchObject([
        { username: "edcoan", dots: 685, country: "Canada", tested: true },
        { username: "ruthrabbitt", dots: 590, country: "USA", tested: true },
      ]);
    });

    it("applies country and tested filters when equipment rankings are precomputed", async () => {
      const { data, pagination } = await service().getRankings({
        equipment: "raw",
        tested: true,
        country: "Canada",
      });

      expect(pagination.items).toBe(1);
      expect(data).toMatchObject([
        { username: "edcoan", dots: 685, country: "Canada", tested: true },
      ]);
    });

    it("combines tested status with athlete country", async () => {
      const rankings = service();
      const tested = await rankings.getRankings({ tested: true, country: "USA" });
      const untested = await rankings.getRankings({ tested: false, country: "USA" });

      expect(tested.data).toMatchObject([{ username: "ruthrabbitt", tested: true }]);
      expect(untested.data).toMatchObject([
        { username: "edcoan", dots: 700, tested: false },
        { username: "johnsmith1", tested: false },
        { username: "kristyhawkins", tested: false },
      ]);
    });

    it("filters by year without requiring preceding path filters", async () => {
      const { data } = await service().getRankings({ year: "2023" });

      expect(data).toMatchObject([
        { username: "marisrazmanis", meet_date: "2023-11-15" },
        { username: "ruthrabbitt", meet_date: "2023-11-15" },
      ]);
    });

    it("filters by age class without requiring equipment or sex", async () => {
      const { data } = await service().getRankings({ age_class: "40-44" });

      expect(data).toMatchObject([{ username: "johnsmith1" }, { username: "ruthrabbitt" }]);
    });

    it("filters by event without requiring preceding path filters", async () => {
      const { data, pagination } = await service().getRankings({ event: "push-pull" });

      expect(data).toEqual([]);
      expect(pagination.items).toBe(0);
    });

    it("distinguishes capped and open-ended weight classes without other filters", async () => {
      const rankings = service();
      const capped = await rankings.getRankings({ weight_class: "84" });
      const open = await rankings.getRankings({ weight_class: "84+" });

      expect(capped.data).toMatchObject([
        { name: "山田太郎", dots: 480, weight_class_kg: 84, weight_class_over: false },
      ]);
      expect(open.data).toMatchObject([
        { name: "山田太郎", dots: 490, weight_class_kg: 84, weight_class_over: true },
      ]);
    });

    it("paginates filtered lifters using ranks within the selected population", async () => {
      const { data, pagination } = await service().getRankings({
        country: "USA",
        current_page: 2,
        per_page: 2,
      });

      expect(data).toMatchObject([
        { username: "kristyhawkins", rank: 3 },
        { username: "ruthrabbitt", rank: 4 },
      ]);
      expect(pagination).toMatchObject({
        items: 4,
        pages: 2,
        current_page: 2,
        per_page: 2,
        from: 3,
        to: 4,
      });
    });

    it("matches legacy filtered responses for the same filters, units, and pagination", async () => {
      const rankings = service();
      const params = {
        equipment: "raw",
        sex: "men",
        weight_class: "100",
        year: "2024",
        event: "full-power",
        sort: "by-total",
      } as const;
      const query = {
        age_class: "24-34",
        federation: "usapl",
        units: "kg",
        current_page: 1,
        per_page: 1,
      } as const;

      const flexible = await rankings.getRankings({ ...params, ...query });
      const legacy = await rankings.getFilteredRankings(params, query);

      expect(flexible.data).toMatchObject([{ username: "edcoan", total: 1055, units: "kg" }]);
      expect(flexible).toEqual(legacy);
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

    it("filters precomputed rankings by weight class", async () => {
      const { data } = await service().getFilteredRankings(
        { equipment: "raw", sex: "men", weight_class: "100" },
        { units: "kg" },
      );
      const usernames = data.map((r) => (r as { username: string }).username);
      expect(usernames).toEqual(["edcoan"]);
    });

    it("filters precomputed rankings by age class", async () => {
      const { data } = await service().getFilteredRankings(
        { equipment: "raw", sex: "men" },
        { age_class: "24-34", units: "kg" },
      );
      const usernames = data.map((r) => (r as { username: string }).username);
      expect(usernames).toEqual(["edcoan", "marisrazmanis"]);
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
      await expect(service().getMaxRank()).resolves.toBe(6);
    });
  });
});
