import { describe, expect, it } from "vitest";

import {
  userIdParamValidation,
  updateApiCountValidation,
  updateApiLimitValidation,
  usersQueryValidation,
  cacheKeyValidation,
  cacheQueryValidation,
  userHistoryQueryValidation,
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

  describe("updateApiCountValidation", () => {
    it("parses valid api_call_count", () => {
      const result = updateApiCountValidation.safeParse({ api_call_count: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.api_call_count).toBe(100);
      }
    });

    it("accepts zero", () => {
      const result = updateApiCountValidation.safeParse({ api_call_count: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.api_call_count).toBe(0);
      }
    });

    it("rejects negative values", () => {
      const result = updateApiCountValidation.safeParse({ api_call_count: "-1" });
      expect(result.success).toBe(false);
    });

    it("rejects missing field", () => {
      const result = updateApiCountValidation.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("updateApiLimitValidation", () => {
    it("parses valid api_call_limit", () => {
      const result = updateApiLimitValidation.safeParse({ api_call_limit: "750" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.api_call_limit).toBe(750);
      }
    });

    it("accepts zero", () => {
      const result = updateApiLimitValidation.safeParse({ api_call_limit: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.api_call_limit).toBe(0);
      }
    });

    it("rejects negative values", () => {
      const result = updateApiLimitValidation.safeParse({ api_call_limit: "-5" });
      expect(result.success).toBe(false);
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

  describe("userHistoryQueryValidation", () => {
    it("accepts empty object with defaults", () => {
      const result = userHistoryQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it("enforces minimum page of 1 for negative values", () => {
      const result = userHistoryQueryValidation.safeParse({ page: "-5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });

    it("accepts search param", () => {
      const result = userHistoryQueryValidation.safeParse({ search: "test" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("test");
      }
    });
  });
});
