import { describe, expect, it } from "vite-plus/test";

import { createContext } from "../context";
import { buildPagination } from "./helpers";

const context = createContext();
const authService = context.authService;
const helpers = context.helpers;

describe.concurrent("helpers.generateToken", () => {
  it("returns a token", () => {
    const token = helpers.generateToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
  });

  it("returns a different token each time", () => {
    const token1 = helpers.generateToken();
    const token2 = helpers.generateToken();
    expect(token1).not.toEqual(token2);
  });

  it("returns a valid UUID format", () => {
    const token = helpers.generateToken();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidRegex);
  });
});

describe.concurrent("authService.generateKey", () => {
  it("returns an API key", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 1,
    });
    expect(apiKey).toBeDefined();
    expect(typeof apiKey).toBe("string");
  });

  it("returns a different key each time for different users", () => {
    const key1 = authService.generateKey({
      userId: "1",
      email: "1test@test.com",
      name: "1Test User",
      apiKeyVersion: 1,
    });
    const key2 = authService.generateKey({
      userId: "2",
      email: "2test@test.com",
      name: "2Test User",
      apiKeyVersion: 1,
    });
    expect(key1).not.toEqual(key2);
  });

  it("expires in 90 days for regular users", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 1,
    });

    const payload = JSON.parse(atob(apiKey.split(".")[1]!));
    const expiresInSeconds = payload.exp - payload.iat;
    const ninetyDaysInSeconds = 90 * 24 * 60 * 60;

    expect(expiresInSeconds).toBe(ninetyDaysInSeconds);
  });

  it("includes apiKeyVersion in the payload", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 5,
    });

    const payload = JSON.parse(atob(apiKey.split(".")[1]!));
    expect(payload.apiKeyVersion).toBe(5);
  });

  describe("when admin flag is passed", () => {
    it("returns an API key", () => {
      const apiKey = authService.generateKey({
        userId: "1",
        email: "",
        name: "",
        apiKeyVersion: 1,
        admin: true,
      });
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe("string");
    });

    it("expires in 1 year for admin users", () => {
      const apiKey = authService.generateKey({
        userId: "1",
        email: "admin@test.com",
        name: "Admin User",
        apiKeyVersion: 1,
        admin: true,
      });

      const payload = JSON.parse(atob(apiKey.split(".")[1]!));
      const expiresInSeconds = payload.exp - payload.iat;
      const oneYearInSeconds = 365.25 * 24 * 60 * 60;

      expect(expiresInSeconds).toBe(oneYearInSeconds);
    });
  });
});

describe.concurrent("helpers.timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(helpers.timingSafeEqual("test", "test")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(helpers.timingSafeEqual("test", "tset")).toBe(false);
  });

  it("returns false for strings of different length", () => {
    expect(helpers.timingSafeEqual("test", "testing")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(helpers.timingSafeEqual("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(helpers.timingSafeEqual("", "test")).toBe(false);
  });

  it("handles special characters", () => {
    const token1 = "abc123!@#$%^&*()";
    const token2 = "abc123!@#$%^&*()";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });

  it("handles UUID-like tokens", () => {
    const token1 = "550e8400-e29b-41d4-a716-446655440000";
    const token2 = "550e8400-e29b-41d4-a716-446655440000";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });
});

describe.concurrent("helpers.extractNameFromEmail", () => {
  it("extracts name from simple email", () => {
    expect(helpers.extractNameFromEmail("john@example.com")).toBe("John");
  });

  it("extracts name with dots", () => {
    expect(helpers.extractNameFromEmail("john.doe@example.com")).toBe("John Doe");
  });

  it("extracts name with underscores", () => {
    expect(helpers.extractNameFromEmail("john_doe@example.com")).toBe("John Doe");
  });

  it("extracts name with hyphens", () => {
    expect(helpers.extractNameFromEmail("john-doe@example.com")).toBe("John Doe");
  });

  it("extracts name with mixed separators", () => {
    expect(helpers.extractNameFromEmail("john.doe_smith-jr@example.com")).toBe("John Doe Smith Jr");
  });

  it("capitalizes each word", () => {
    expect(helpers.extractNameFromEmail("JOHN.DOE@example.com")).toBe("John Doe");
  });

  it("handles single character parts", () => {
    expect(helpers.extractNameFromEmail("j.doe@example.com")).toBe("J Doe");
  });
});

describe.concurrent("buildPagination", () => {
  it("returns correct pagination for first page", () => {
    const result = buildPagination(100, 1, 10);
    expect(result).toEqual({
      items: 100,
      pages: 10,
      per_page: 10,
      current_page: 1,
      last_page: 10,
      first_page: 1,
      from: 1,
      to: 10,
    });
  });

  it("returns correct pagination for middle page", () => {
    const result = buildPagination(100, 5, 10);
    expect(result.from).toBe(41);
    expect(result.to).toBe(50);
  });

  it("returns correct pagination for last page", () => {
    const result = buildPagination(100, 10, 10);
    expect(result.from).toBe(91);
    expect(result.to).toBe(100);
  });

  it("handles partial last page", () => {
    const result = buildPagination(95, 10, 10);
    expect(result.from).toBe(91);
    expect(result.to).toBe(95);
  });

  it("clamps page to max when exceeding total pages", () => {
    const result = buildPagination(50, 100, 10);
    expect(result.current_page).toBe(5);
    expect(result.pages).toBe(5);
  });

  it("clamps page to 1 when page is zero or negative", () => {
    expect(buildPagination(50, 0, 10).current_page).toBe(1);
    expect(buildPagination(50, -5, 10).current_page).toBe(1);
  });

  it("handles empty results", () => {
    const result = buildPagination(0, 1, 10);
    expect(result.items).toBe(0);
    expect(result.from).toBe(0);
    expect(result.to).toBe(0);
  });
});
