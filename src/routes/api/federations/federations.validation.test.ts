import { describe, expect, test } from "vitest";

import { configuration } from "../../../configuration";
import { getFederationsValidation } from "./federations.validation";

const { maxPerPage } = configuration.pagination;

describe("federations validation", () => {
  describe("getFederationsValidation", () => {
    test("accepts valid per_page within limit", () => {
      const result = getFederationsValidation.safeParse({ per_page: "50" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(50);
      }
    });

    test("caps per_page at maxPerPage", () => {
      const result = getFederationsValidation.safeParse({ per_page: "600" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    test("enforces minimum current_page of 1", () => {
      const result = getFederationsValidation.safeParse({ current_page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    test("accepts empty object with optional fields", () => {
      const result = getFederationsValidation.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
