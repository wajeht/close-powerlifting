import { describe, expect, test } from "vitest";

import { config } from "./config";

describe("config", () => {
  describe("pagination", () => {
    test("has defaultPerPage set to 100", () => {
      expect(config.pagination.defaultPerPage).toBe(100);
    });

    test("has maxPerPage set to 500", () => {
      expect(config.pagination.maxPerPage).toBe(500);
    });

    test("defaultPerPage is less than or equal to maxPerPage", () => {
      expect(config.pagination.defaultPerPage).toBeLessThanOrEqual(config.pagination.maxPerPage);
    });
  });

  describe("app", () => {
    test("has required app settings", () => {
      expect(config.app).toHaveProperty("port");
      expect(config.app).toHaveProperty("env");
      expect(config.app).toHaveProperty("version");
      expect(config.app).toHaveProperty("domain");
    });

    test("port is a number", () => {
      expect(typeof config.app.port).toBe("number");
    });

    test("defaultApiCallLimit is 500", () => {
      expect(config.app.defaultApiCallLimit).toBe(500);
    });
  });

  describe("session", () => {
    test("has required session settings", () => {
      expect(config.session).toHaveProperty("name");
      expect(config.session).toHaveProperty("secret");
    });
  });

  describe("email", () => {
    test("has required email settings", () => {
      expect(config.email).toHaveProperty("host");
      expect(config.email).toHaveProperty("port");
      expect(config.email).toHaveProperty("from");
    });

    test("port is a number", () => {
      expect(typeof config.email.port).toBe("number");
    });
  });

  describe("cookie", () => {
    test("has required cookie settings", () => {
      expect(config.cookie).toHaveProperty("expiration");
      expect(config.cookie).toHaveProperty("password");
      expect(config.cookie).toHaveProperty("name");
    });
  });

  describe("oauth", () => {
    test("has google oauth settings", () => {
      expect(config.oauth).toHaveProperty("google");
      expect(config.oauth.google).toHaveProperty("clientId");
      expect(config.oauth.google).toHaveProperty("clientSecret");
      expect(config.oauth.google).toHaveProperty("redirectUrl");
    });
  });
});
