import { describe, expect, it } from "vite-plus/test";

import {
  userIdParamValidation,
  usersQueryValidation,
  cacheKeyValidation,
  cacheQueryValidation,
} from "./admin.validation";

describe.concurrent("admin validation", () => {
  describe("userIdParamValidation", () => {
    it("parses string id to number", () => {
      const result = userIdParamValidation.safeParse({ id: "42" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it("rejects missing id", () => {
      const result = userIdParamValidation.safeParse({});
      expect(result.success).toBe(false);
    });

    it("parses non-numeric string to NaN", () => {
      const result = userIdParamValidation.safeParse({ id: "abc" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeNaN();
      }
    });
  });

  describe("usersQueryValidation", () => {
    it("accepts empty object with defaults", () => {
      const result = usersQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.search).toBeUndefined();
      }
    });

    it("parses page string to number", () => {
      const result = usersQueryValidation.safeParse({ page: "3" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
      }
    });

    it("enforces minimum page of 1", () => {
      const result = usersQueryValidation.safeParse({ page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it("accepts search string", () => {
      const result = usersQueryValidation.safeParse({ search: "john" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("john");
      }
    });
  });

  describe("cacheKeyValidation", () => {
    it("accepts non-empty key", () => {
      const result = cacheKeyValidation.safeParse({ key: "rankings" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe("rankings");
      }
    });

    it("rejects empty key", () => {
      const result = cacheKeyValidation.safeParse({ key: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing key", () => {
      const result = cacheKeyValidation.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("cacheQueryValidation", () => {
    it("accepts empty object with defaults", () => {
      const result = cacheQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it("parses page and search", () => {
      const result = cacheQueryValidation.safeParse({ page: "2", search: "status" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.search).toBe("status");
      }
    });
  });
});
