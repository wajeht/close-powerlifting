import { describe, expect, test } from "vitest";

import { configuration } from "../../../configuration";
import { getUsersValidation, getUserValidation } from "./users.validation";

const { maxPerPage } = configuration.pagination;

describe("users validation", () => {
  describe("getUsersValidation", () => {
    test("accepts valid search query", () => {
      const result = getUsersValidation.safeParse({ search: "haack" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("haack");
      }
    });

    test("accepts valid per_page within limit", () => {
      const result = getUsersValidation.safeParse({ search: "test", per_page: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(100);
      }
    });

    test("caps per_page at maxPerPage", () => {
      const result = getUsersValidation.safeParse({ search: "test", per_page: "1000" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    test("enforces minimum current_page of 1", () => {
      const result = getUsersValidation.safeParse({ search: "test", current_page: "-1" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    test("accepts empty object with optional fields", () => {
      const result = getUsersValidation.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("getUserValidation", () => {
    test("accepts valid username", () => {
      const result = getUserValidation.safeParse({ username: "johnhaack" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("johnhaack");
      }
    });

    test("rejects missing username", () => {
      const result = getUserValidation.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
