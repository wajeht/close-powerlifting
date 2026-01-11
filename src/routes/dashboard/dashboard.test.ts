import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, it } from "vitest";

import {
  app,
  knex,
  createUnauthenticatedSessionAgent,
  extractCsrfToken,
} from "../../tests/test-setup";

describe("Dashboard Routes", () => {
  let testUserId: number;
  const testEmail = "dashboard-test@example.com";
  const testMagicToken = "dashboard-magic-token-123";
  const testName = "Dashboard Test User";

  beforeAll(async () => {
    const [user] = await knex("users")
      .insert({
        name: testName,
        email: testEmail,
        verification_token: testMagicToken,
        api_key: "test-dashboard-key",
        api_call_count: 50,
        api_call_limit: 100,
        admin: false,
        verified: true,
      })
      .returning("*");
    testUserId = user.id;
  });

  afterAll(async () => {
    await knex("users").where({ id: testUserId }).delete();
  });

  describe("GET /dashboard - unauthenticated", () => {
    it("should redirect to login", async () => {
      const response = await request(app).get("/dashboard");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("GET /dashboard - authenticated", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    it("should render dashboard with user info", async () => {
      const response = await sessionAgent.get("/dashboard");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Dashboard");
      expect(response.text).toContain("API Usage");
      expect(response.text).toContain("50");
    });

    it("should redirect to login if session user is deleted from database", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Temp User",
          email: "temp-dashboard@example.com",
          verification_token: "temp-dashboard-token",
          verified: true,
        })
        .returning("*");

      const tempAgent = createUnauthenticatedSessionAgent();
      await tempAgent.get(`/magic-link?token=temp-dashboard-token&email=temp-dashboard@example.com`);

      const dashboardBefore = await tempAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      await knex("users").where({ id: tempUser.id }).delete();

      const dashboardAfter = await tempAgent.get("/dashboard");
      expect(dashboardAfter.status).toBe(302);
      expect(dashboardAfter.headers.location).toBe("/login");
    });
  });

  describe("Admin stats on dashboard", () => {
    it("should show admin stats for admin users", async () => {
      const [adminUser] = await knex("users")
        .insert({
          name: "Admin Dashboard User",
          email: "admin-dashboard@example.com",
          verification_token: "admin-dashboard-token",
          verified: true,
          admin: true,
        })
        .returning("*");

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(
        `/magic-link?token=admin-dashboard-token&email=admin-dashboard@example.com`,
      );

      const response = await sessionAgent.get("/dashboard");

      expect(response.status).toBe(200);
      expect(response.text).toContain("System Overview");

      await knex("users").where({ id: adminUser.id }).delete();
    });
  });

  describe("Flash messages", () => {
    it("should show flash message when already logged in user visits login page", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const loginResponse = await sessionAgent.get("/login");
      expect(loginResponse.status).toBe(302);
      expect(loginResponse.headers.location).toBe("/dashboard");

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain("already logged in");
    });
  });

  describe("Session persistence", () => {
    it("should maintain session across multiple requests", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const dashboard1 = await sessionAgent.get("/dashboard");
      expect(dashboard1.status).toBe(200);

      const settings = await sessionAgent.get("/settings");
      expect(settings.status).toBe(200);

      const dashboard2 = await sessionAgent.get("/dashboard");
      expect(dashboard2.status).toBe(200);
    });
  });

  describe("Session isolation", () => {
    it("should not share sessions between different agents", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent1 = createUnauthenticatedSessionAgent();
      const sessionAgent2 = createUnauthenticatedSessionAgent();

      await sessionAgent1.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const dashboard1 = await sessionAgent1.get("/dashboard");
      expect(dashboard1.status).toBe(200);

      const dashboard2 = await sessionAgent2.get("/dashboard");
      expect(dashboard2.status).toBe(302);
      expect(dashboard2.headers.location).toBe("/login");
    });

    it("should not affect other sessions when one logs out", async () => {
      const [user2] = await knex("users")
        .insert({
          name: "Session Test User 2",
          email: "session-test-dashboard@example.com",
          verification_token: "session-token-dashboard",
          verified: true,
        })
        .returning("*");

      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent1 = createUnauthenticatedSessionAgent();
      const sessionAgent2 = createUnauthenticatedSessionAgent();

      await sessionAgent1.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
      await sessionAgent2.get(
        `/magic-link?token=session-token-dashboard&email=session-test-dashboard@example.com`,
      );

      const dashboard1Before = await sessionAgent1.get("/dashboard");
      expect(dashboard1Before.status).toBe(200);
      const dashboard2Before = await sessionAgent2.get("/dashboard");
      expect(dashboard2Before.status).toBe(200);

      const dashboardPage = await sessionAgent1.get("/dashboard");
      const csrfToken = extractCsrfToken(dashboardPage.text);
      await sessionAgent1.post("/logout").type("form").send({ _csrf: csrfToken });

      const dashboard1After = await sessionAgent1.get("/dashboard");
      expect(dashboard1After.status).toBe(302);

      const dashboard2After = await sessionAgent2.get("/dashboard");
      expect(dashboard2After.status).toBe(200);

      await knex("users").where({ id: user2.id }).delete();
    });
  });

  describe("Session destruction", () => {
    it("should clear session after logout", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const dashboardBefore = await sessionAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      const dashboardPage = await sessionAgent.get("/dashboard");
      const csrfToken = extractCsrfToken(dashboardPage.text);
      await sessionAgent.post("/logout").type("form").send({ _csrf: csrfToken });

      const dashboardAfter = await sessionAgent.get("/dashboard");
      expect(dashboardAfter.status).toBe(302);
      expect(dashboardAfter.headers.location).toBe("/login");
    });

    it("should destroy session when user is deleted from database during active session", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Destroy Session User",
          email: "destroy-session-dashboard@example.com",
          verification_token: "destroy-dashboard-token",
          verified: true,
        })
        .returning("*");

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(
        `/magic-link?token=destroy-dashboard-token&email=destroy-session-dashboard@example.com`,
      );

      const dashboardBefore = await sessionAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      await knex("users").where({ id: tempUser.id }).delete();

      const dashboardAfter = await sessionAgent.get("/dashboard");
      expect(dashboardAfter.status).toBe(302);
      expect(dashboardAfter.headers.location).toBe("/login");
    });
  });
});
