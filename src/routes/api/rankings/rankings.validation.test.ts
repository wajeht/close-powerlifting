import { describe, expect, test } from "vitest";

import { configuration } from "../../../configuration";
import { getRankingsValidation, getFilteredRankingsQueryValidation } from "./rankings.validation";

const { maxPerPage } = configuration.pagination;

describe("rankings validation", () => {
  describe("getRankingsValidation", () => {
    it("accepts valid per_page within limit", () => {
      const result = getRankingsValidation.safeParse({ per_page: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(100);
      }
    });

    it("caps per_page at maxPerPage", () => {
      const result = getRankingsValidation.safeParse({ per_page: "1000" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    it("accepts valid current_page", () => {
      const result = getRankingsValidation.safeParse({ current_page: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(5);
      }
    });

    it("enforces minimum current_page of 1", () => {
      const result = getRankingsValidation.safeParse({ current_page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("enforces minimum current_page of 1 for negative values", () => {
      const result = getRankingsValidation.safeParse({ current_page: "-5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("accepts empty object with optional fields", () => {
      const result = getRankingsValidation.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("getFilteredRankingsQueryValidation", () => {
    it("caps per_page at maxPerPage", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ per_page: "999" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });
  });
});
