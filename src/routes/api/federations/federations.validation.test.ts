import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import {
  getFederationsParamValidation,
  getFederationsQueryValidation,
  getFederationsValidation,
} from "./federations.validation";

const { maxPerPage } = configuration.pagination;

describe.concurrent("federations validation", () => {
  describe("getFederationsValidation", () => {
    it("accepts valid per_page within limit", () => {
      const result = getFederationsValidation.safeParse({ per_page: "50" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(50);
      }
    });

    it("caps per_page at maxPerPage", () => {
      const result = getFederationsValidation.safeParse({ per_page: "600" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    it("enforces minimum current_page of 1", () => {
      const result = getFederationsValidation.safeParse({ current_page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("rejects non-numeric per_page", () => {
      const result = getFederationsValidation.safeParse({ per_page: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric current_page", () => {
      const result = getFederationsValidation.safeParse({ current_page: "abc" });
      expect(result.success).toBe(false);
    });

    it("accepts empty object with optional fields", () => {
      const result = getFederationsValidation.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("getFederationsParamValidation", () => {
    it("accepts federation slugs", () => {
      const result = getFederationsParamValidation.safeParse({ federation: "wrpf-usa" });
      expect(result.success).toBe(true);
    });

    it("rejects malformed federation slugs", () => {
      const result = getFederationsParamValidation.safeParse({ federation: "wrpf/usa" });
      expect(result.success).toBe(false);
    });
  });

  describe("getFederationsQueryValidation", () => {
    it("parses valid years", () => {
      const result = getFederationsQueryValidation.safeParse({ year: "2024" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.year).toBe(2024);
      }
    });

    it("rejects invalid years", () => {
      const result = getFederationsQueryValidation.safeParse({ year: "latest" });
      expect(result.success).toBe(false);
    });
  });
});
