import { describe, expect, test } from "vitest";

import { configuration } from "./configuration";

describe("config", () => {
  describe("pagination", () => {
    it("has defaultPerPage set to 100", () => {
      expect(configuration.pagination.defaultPerPage).toBe(100);
    });

    it("has maxPerPage set to 500", () => {
      expect(configuration.pagination.maxPerPage).toBe(500);
    });

    it("defaultPerPage is less than or equal to maxPerPage", () => {
      expect(configuration.pagination.defaultPerPage).toBeLessThanOrEqual(
        configuration.pagination.maxPerPage,
      );
    });
  });

  describe("app", () => {
    it("has required app settings", () => {
      expect(configuration.app).toHaveProperty("port");
      expect(configuration.app).toHaveProperty("env");
      expect(configuration.app).toHaveProperty("version");
      expect(configuration.app).toHaveProperty("domain");
    });

    it("port is a number", () => {
      expect(typeof configuration.app.port).toBe("number");
    });

    it("defaultApiCallLimit is 500", () => {
      expect(configuration.app.defaultApiCallLimit).toBe(500);
    });
  });

  describe("session", () => {
    it("has required session settings", () => {
      expect(configuration.session).toHaveProperty("name");
      expect(configuration.session).toHaveProperty("secret");
    });
  });

  describe("email", () => {
    it("has required email settings", () => {
      expect(configuration.email).toHaveProperty("host");
      expect(configuration.email).toHaveProperty("port");
      expect(configuration.email).toHaveProperty("from");
    });

    it("port is a number", () => {
      expect(typeof configuration.email.port).toBe("number");
    });
  });

  describe("cookie", () => {
    it("has required cookie settings", () => {
      expect(configuration.cookie).toHaveProperty("expiration");
      expect(configuration.cookie).toHaveProperty("password");
      expect(configuration.cookie).toHaveProperty("name");
    });
  });

  describe("oauth", () => {
    it("has google oauth settings", () => {
      expect(configuration.oauth).toHaveProperty("google");
      expect(configuration.oauth.google).toHaveProperty("clientId");
      expect(configuration.oauth.google).toHaveProperty("clientSecret");
      expect(configuration.oauth.google).toHaveProperty("redirectUrl");
    });
  });
});
