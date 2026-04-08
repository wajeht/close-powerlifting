import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import { getUsersValidation, getUserValidation, getUserQueryValidation } from "./users.validation";

const { maxPerPage } = configuration.pagination;

describe.concurrent("users validation", () => {
  describe("getUsersValidation", () => {
    it("accepts valid search query", () => {
      const result = getUsersValidation.safeParse({ search: "haack" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("haack");
      }
    });

    it("accepts valid per_page within limit", () => {
      const result = getUsersValidation.safeParse({ search: "test", per_page: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(100);
      }
    });

    it("caps per_page at maxPerPage", () => {
      const result = getUsersValidation.safeParse({ search: "test", per_page: "1000" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    it("enforces minimum current_page of 1", () => {
      const result = getUsersValidation.safeParse({ search: "test", current_page: "-1" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("accepts empty object with optional fields", () => {
      const result = getUsersValidation.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts units=lbs", () => {
      const result = getUsersValidation.safeParse({ units: "lbs" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts units=kg", () => {
      const result = getUsersValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
      }
    });

    it("rejects invalid units value", () => {
      const result = getUsersValidation.safeParse({ units: "stones" });
      expect(result.success).toBe(false);
    });
  });

  describe("getUserValidation", () => {
    it("accepts valid username", () => {
      const result = getUserValidation.safeParse({ username: "johnhaack" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("johnhaack");
      }
    });

    it("rejects missing username", () => {
      const result = getUserValidation.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersValidation defaults", () => {
    it("defaults units to lbs when not provided", () => {
      const result = getUsersValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts search + units + pagination together", () => {
      const result = getUsersValidation.safeParse({
        search: "haack",
        units: "kg",
        per_page: "50",
        current_page: "2",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("haack");
        expect(result.data.units).toBe("kg");
        expect(result.data.per_page).toBe(50);
        expect(result.data.current_page).toBe(2);
      }
    });
  });

  describe("getUserQueryValidation", () => {
    it("accepts include_attempts=true", () => {
      const result = getUserQueryValidation.safeParse({ include_attempts: "true" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.include_attempts).toBe("true");
      }
    });

    it("accepts include_attempts=false", () => {
      const result = getUserQueryValidation.safeParse({ include_attempts: "false" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.include_attempts).toBe("false");
      }
    });

    it("defaults include_attempts to false", () => {
      const result = getUserQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.include_attempts).toBe("false");
      }
    });

    it("rejects invalid include_attempts value", () => {
      const result = getUserQueryValidation.safeParse({ include_attempts: "yes" });
      expect(result.success).toBe(false);
    });

    it("accepts units=lbs", () => {
      const result = getUserQueryValidation.safeParse({ units: "lbs" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts units=kg", () => {
      const result = getUserQueryValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
      }
    });

    it("defaults units to lbs", () => {
      const result = getUserQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("rejects invalid units value", () => {
      const result = getUserQueryValidation.safeParse({ units: "stones" });
      expect(result.success).toBe(false);
    });

    it("accepts include_attempts + units together", () => {
      const result = getUserQueryValidation.safeParse({ include_attempts: "true", units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.include_attempts).toBe("true");
        expect(result.data.units).toBe("kg");
      }
    });
  });
});
