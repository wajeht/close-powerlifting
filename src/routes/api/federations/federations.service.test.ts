import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createFederationsService } from "./federations.service";

function service() {
  return createFederationsService(createTestContext().store);
}

describe("federations service", () => {
  describe("getFederations", () => {
    it("returns all federations with pagination metadata", async () => {
      const { data, pagination } = await service().getFederations({});
      expect(data.length).toBeGreaterThan(0);
      expect(pagination.items).toBeGreaterThan(0);
      expect(pagination.current_page).toBe(1);
    });

    it("honours per_page", async () => {
      const result = await service().getFederations({ per_page: 1 });
      expect(result.data).toHaveLength(1);
      expect(result.pagination.per_page).toBe(1);
    });
  });

  describe("getFederation", () => {
    it("returns federation details for a known slug", async () => {
      const result = await service().getFederation("wrpf", {});
      expect(result).not.toBeNull();
      expect(result!.code).toBe("WRPF");
      expect(result!.meets[0]!.path).toBe("wrpf/2024-05-12/wrpfamericanpro");
    });

    it("returns null for an unknown slug", async () => {
      await expect(service().getFederation("nope", {})).resolves.toBeNull();
    });

    it("filters meets by year", async () => {
      const result = await service().getFederation("ipf", { year: 2099 });
      expect(result).not.toBeNull();
      expect(result!.meets).toHaveLength(0);
    });
  });

  describe("getFederationStats", () => {
    it("returns year-bucketed meet counts sorted desc", async () => {
      const result = await service().getFederationStats("wrpf");
      expect(result).not.toBeNull();
      expect(result!.meets_by_year[0]).toEqual({ year: 2024, meet_count: 1 });
    });

    it("returns null for an unknown slug", async () => {
      await expect(service().getFederationStats("nope")).resolves.toBeNull();
    });
  });
});
