import { describe, expect, it } from "vite-plus/test";

import { app } from "../../tests/test-setup";
import request from "supertest";

describe("general routes", () => {
  describe("GET /", () => {
    it("should return 200 with home page", async () => {
      const response = await request(app).get("/");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Close Powerlifting");
    });
  });

  describe("GET /about", () => {
    it("should return 200 with about page", async () => {
      const response = await request(app).get("/about");
      expect(response.status).toBe(200);
      expect(response.text).toContain("About");
    });
  });

  describe("GET /contact", () => {
    it("should redirect to github issues", async () => {
      const response = await request(app).get("/contact");
      expect(response.status).toBe(301);
      expect(response.headers.location).toContain("github.com");
    });
  });

  describe("GET /terms", () => {
    it("should return 200 with terms page", async () => {
      const response = await request(app).get("/terms");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Terms");
    });
  });

  describe("GET /privacy", () => {
    it("should return 200 with privacy page", async () => {
      const response = await request(app).get("/privacy");
      expect(response.status).toBe(200);
      expect(response.text).toContain("Privacy");
    });
  });

  describe("GET /health-check", () => {
    it("should return 200 with health status", async () => {
      const response = await request(app).get("/health-check");
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body).toHaveProperty("uptime");
      expect(response.body).toHaveProperty("timestamp");
      expect(response.body).toHaveProperty("database");
    });
  });

  describe("GET /healthz", () => {
    it("should return 200 with health status", async () => {
      const response = await request(app).get("/healthz");
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });

  describe("GET /nonexistent", () => {
    it("should return 404", async () => {
      const response = await request(app).get("/nonexistent-page");
      expect(response.status).toBe(404);
    });
  });
});
