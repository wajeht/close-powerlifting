import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, afterEach, it } from "vitest";

import {
  app,
  knex,
  createUnauthenticatedSessionAgent,
  extractCsrfToken,
} from "../../tests/test-setup";

describe("Auth Routes", () => {
  let testUserId: number;
  const testEmail = "auth-test@example.com";
  const testMagicToken = "test-magic-token-123";
  const testName = "Auth Test User";

  beforeAll(async () => {
    const [user] = await knex("users")
      .insert({
        name: testName,
        email: testEmail,
        verification_token: testMagicToken,
        api_key: "test-auth-key",
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

  describe("GET /login", () => {
    it("should render login page", async () => {
      const response = await request(app).get("/login");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Get started");
      expect(response.text).toContain("Continue with Email");
    });

    it("should redirect to dashboard if already logged in", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const response = await sessionAgent.get("/login");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");
    });
  });

  describe("POST /login", () => {
    it("should redirect back to login with info message for valid email", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const loginPage = await agent.get("/login");
      const csrfToken = extractCsrfToken(loginPage.text);

      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: testEmail, _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect back to login for non-existent user", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const loginPage = await agent.get("/login");
      const csrfToken = extractCsrfToken(loginPage.text);

      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: "nonexistent@example.com", _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect back to login for unverified user", async () => {
      const [unverifiedUser] = await knex("users")
        .insert({
          name: "Unverified User",
          email: "unverified-test@example.com",
          verification_token: "unverified-token",
          verified: false,
        })
        .returning("*");

      const agent = createUnauthenticatedSessionAgent();
      const loginPage = await agent.get("/login");
      const csrfToken = extractCsrfToken(loginPage.text);

      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: "unverified-test@example.com", _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      await knex("users").where({ id: unverifiedUser.id }).delete();
    });
  });

  describe("GET /magic-link", () => {
    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({ verification_token: testMagicToken });
    });

    it("should login user with valid magic link", async () => {
      const sessionAgent = createUnauthenticatedSessionAgent();
      const response = await sessionAgent.get(
        `/magic-link?token=${testMagicToken}&email=${testEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);
    });

    it("should reject invalid token", async () => {
      const response = await request(app).get(`/magic-link?token=wrong-token&email=${testEmail}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should reject missing token", async () => {
      const response = await request(app).get(`/magic-link?email=${testEmail}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should reject expired magic link", async () => {
      const expiredTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: expiredTime,
      });

      const response = await request(app).get(
        `/magic-link?token=${testMagicToken}&email=${testEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("POST /logout", () => {
    it("should logout and redirect to login", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const dashboardPage = await sessionAgent.get("/dashboard");
      const csrfToken = extractCsrfToken(dashboardPage.text);

      const response = await sessionAgent.post("/logout").type("form").send({ _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(302);
      expect(dashboardResponse.headers.location).toBe("/login");
    });
  });

  describe("POST /login - new user registration", () => {
    afterEach(async () => {
      await knex("users").where({ email: "new-user@example.com" }).delete();
    });

    it("should create new user and redirect when email does not exist", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const loginPage = await agent.get("/login");
      const csrfToken = extractCsrfToken(loginPage.text);

      const response = await agent.post("/login").type("form").send({
        email: "new-user@example.com",
        _csrf: csrfToken,
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ email: "new-user@example.com" }).first();
      expect(user).toBeDefined();
      expect(user.name).toBe("New User");
      expect(user.verification_token).toBeDefined();
      expect(user.verified).toBe(0);
    });
  });

  describe("Protected routes without authentication", () => {
    it("should redirect GET /dashboard to login", async () => {
      const response = await request(app).get("/dashboard");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect GET /settings to login", async () => {
      const response = await request(app).get("/settings");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /settings to login", async () => {
      const response = await request(app).post("/settings").type("form").send({ name: "Hacker" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /settings/regenerate-key to login", async () => {
      const response = await request(app).post("/settings/regenerate-key");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /settings/delete to login", async () => {
      const response = await request(app).post("/settings/delete");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("Dashboard routes with authentication", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    describe("GET /dashboard", () => {
      it("should render dashboard with user info", async () => {
        const response = await sessionAgent.get("/dashboard");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Dashboard");
        expect(response.text).toContain("API Usage");
        expect(response.text).toContain("50"); // api_call_count
      });
    });

    describe("POST /settings/regenerate-key", () => {
      it("should regenerate API key", async () => {
        const beforeUser = await knex("users").where({ id: testUserId }).first();
        const beforeKey = beforeUser.api_key;

        const settingsPage = await sessionAgent.get("/settings");
        const csrfToken = extractCsrfToken(settingsPage.text);

        const response = await sessionAgent
          .post("/settings/regenerate-key")
          .type("form")
          .send({ _csrf: csrfToken });

        expect(response.status).toBe(200);

        const afterUser = await knex("users").where({ id: testUserId }).first();
        expect(afterUser.api_key).not.toBe(beforeKey);
      });
    });
  });

  describe("Profile routes with authentication", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    describe("GET /settings", () => {
      it("should render settings page", async () => {
        const response = await sessionAgent.get("/settings");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Settings");
        expect(response.text).toContain(testEmail);
        expect(response.text).toContain(testName);
      });
    });

    describe("POST /settings", () => {
      afterEach(async () => {
        await knex("users").where({ id: testUserId }).update({ name: testName });
      });

      it("should update user name", async () => {
        const settingsPage = await sessionAgent.get("/settings");
        const csrfToken = extractCsrfToken(settingsPage.text);

        const response = await sessionAgent
          .post("/settings")
          .type("form")
          .send({ name: "Updated Name", _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/settings");

        const user = await knex("users").where({ id: testUserId }).first();
        expect(user.name).toBe("Updated Name");
      });
    });

    describe("POST /settings/delete", () => {
      let deleteUserId: number;
      const deleteMagicToken = "delete-magic-token";

      beforeEach(async () => {
        const [user] = await knex("users")
          .insert({
            name: "Delete Test User",
            email: "delete-test@example.com",
            verification_token: deleteMagicToken,
            verified: true,
          })
          .returning("*");
        deleteUserId = user.id;
      });

      it("should delete account and logout", async () => {
        const deleteSessionAgent = createUnauthenticatedSessionAgent();
        await deleteSessionAgent.get(
          `/magic-link?token=${deleteMagicToken}&email=delete-test@example.com`,
        );

        const settingsPage = await deleteSessionAgent.get("/settings");
        const csrfToken = extractCsrfToken(settingsPage.text);

        const response = await deleteSessionAgent
          .post("/settings/delete")
          .type("form")
          .send({ _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/login");

        const user = await knex("users").where({ id: deleteUserId }).first();
        expect(user).toBeUndefined();
      });
    });
  });

  describe("GET /verify-email - auto login flow", () => {
    let verifyUserId: number;
    const verifyEmail = "verify-auto-login@example.com";
    const verifyToken = "verify-auto-login-token";

    beforeEach(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Verify User",
          email: verifyEmail,
          verification_token: verifyToken,
          verified: false,
        })
        .returning("*");
      verifyUserId = user.id;
    });

    afterEach(async () => {
      await knex("users").where({ id: verifyUserId }).delete();
    });

    it("should auto-login user after email verification and redirect to dashboard", async () => {
      const sessionAgent = createUnauthenticatedSessionAgent();

      const response = await sessionAgent.get(
        `/verify-email?token=${verifyToken}&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      const user = await knex("users").where({ id: verifyUserId }).first();
      expect(user.verified).toBe(1);
      expect(user.verification_token).toBeNull();

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain("Dashboard");
    });

    it("should reject verification with invalid token", async () => {
      const response = await request(app).get(
        `/verify-email?token=wrong-token&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ id: verifyUserId }).first();
      expect(user.verified).toBe(0);
    });

    it("should redirect already verified users to login", async () => {
      await knex("users").where({ id: verifyUserId }).update({ verified: true });

      const response = await request(app).get(
        `/verify-email?token=${verifyToken}&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should reject verification for non-existent user", async () => {
      const response = await request(app).get(
        `/verify-email?token=any-token&email=nonexistent@example.com`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("Session user edge cases", () => {
    it("should redirect to login if session user is deleted from database", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Temp User",
          email: "temp-user@example.com",
          verification_token: "temp-token",
          verified: true,
        })
        .returning("*");

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=temp-token&email=temp-user@example.com`);

      const dashboardBefore = await sessionAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      await knex("users").where({ id: tempUser.id }).delete();

      const dashboardAfter = await sessionAgent.get("/dashboard");
      expect(dashboardAfter.status).toBe(302);
      expect(dashboardAfter.headers.location).toBe("/login");
    });

    it("should redirect non-admin to login when accessing admin routes", async () => {
      const sessionAgent = createUnauthenticatedSessionAgent();
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
        admin: false,
      });
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const response = await sessionAgent.get("/admin");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should allow admin to access admin routes", async () => {
      const [adminUser] = await knex("users")
        .insert({
          name: "Admin User",
          email: "admin-test@example.com",
          verification_token: "admin-token",
          verified: true,
          admin: true,
        })
        .returning("*");

      const sessionAgent = createUnauthenticatedSessionAgent();
      const magicLinkResponse = await sessionAgent.get(
        `/magic-link?token=admin-token&email=admin-test@example.com`,
      );

      expect(magicLinkResponse.status).toBe(302);
      expect(magicLinkResponse.headers.location).toBe("/dashboard");

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);

      const response = await sessionAgent.get("/admin/users");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Manage Users");

      await knex("users").where({ id: adminUser.id }).delete();
    });
  });

  describe("Validation edge cases", () => {
    it("POST /login should reject invalid email format", async () => {
      const agent = createUnauthenticatedSessionAgent();
      const loginPage = await agent.get("/login");
      const csrfToken = extractCsrfToken(loginPage.text);

      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: "not-an-email", _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("POST /settings should reject empty name", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      const response = await sessionAgent
        .post("/settings")
        .type("form")
        .send({ name: "", _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/settings");

      const user = await knex("users").where({ id: testUserId }).first();
      expect(user.name).toBe(testName);
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

    it("should update session name after name change", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      await sessionAgent
        .post("/settings")
        .type("form")
        .send({ name: "Updated Session Name", _csrf: csrfToken });

      const settingsPageAfter = await sessionAgent.get("/settings");
      expect(settingsPageAfter.text).toContain("Updated Session Name");

      await knex("users").where({ id: testUserId }).update({ name: testName });
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
          email: "session-test-2@example.com",
          verification_token: "session-token-2",
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
      await sessionAgent2.get(`/magic-link?token=session-token-2&email=session-test-2@example.com`);

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
    it("should clear session cookie after logout", async () => {
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

      const settingsAfter = await sessionAgent.get("/settings");
      expect(settingsAfter.status).toBe(302);
      expect(settingsAfter.headers.location).toBe("/login");
    });

    it("should destroy session when user is deleted from database during active session", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Destroy Session User",
          email: "destroy-session@example.com",
          verification_token: "destroy-token",
          verified: true,
        })
        .returning("*");

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=destroy-token&email=destroy-session@example.com`);

      const dashboardBefore = await sessionAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      await knex("users").where({ id: tempUser.id }).delete();

      const dashboardAfter = await sessionAgent.get("/dashboard");
      expect(dashboardAfter.status).toBe(302);
      expect(dashboardAfter.headers.location).toBe("/login");

      const settingsAfter = await sessionAgent.get("/settings");
      expect(settingsAfter.status).toBe(302);
      expect(settingsAfter.headers.location).toBe("/login");
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

    it("should show success flash after updating name", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      const updateResponse = await sessionAgent
        .post("/settings")
        .type("form")
        .send({ name: "Flash Test Name", _csrf: csrfToken });

      expect(updateResponse.status).toBe(302);

      const settingsAfter = await sessionAgent.get("/settings");
      expect(settingsAfter.text).toContain("updated successfully");

      await knex("users").where({ id: testUserId }).update({ name: testName });
    });

    it("should show success flash after regenerating API key", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      const response = await sessionAgent
        .post("/settings/regenerate-key")
        .type("form")
        .send({ _csrf: csrfToken });

      expect(response.status).toBe(200);
      expect(response.text).toContain("generated");
      expect(response.text).toContain("email");
    });
  });

  describe("Security: Verification token expiry", () => {
    let securityUserId: number;
    const securityEmail = "verify-expiry@example.com";
    const securityToken = "verify-expiry-token";

    beforeAll(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Verify Expiry Test",
          email: securityEmail,
          verification_token: securityToken,
          verified: false,
        })
        .returning("*");
      securityUserId = user.id;
    });

    afterAll(async () => {
      await knex("users").where({ id: securityUserId }).delete();
    });

    it("should reject verification with expired token", async () => {
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      await knex("users").where({ id: securityUserId }).update({
        verification_token: securityToken,
        magic_link_expires_at: expiredTime,
        verified: false,
      });

      const response = await request(app).get(
        `/verify-email?token=${securityToken}&email=${securityEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ id: securityUserId }).first();
      expect(user.verified).toBe(0);
    });

    it("should accept verification with non-expired token", async () => {
      const validTime = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
      await knex("users").where({ id: securityUserId }).update({
        verification_token: securityToken,
        magic_link_expires_at: validTime,
        verified: false,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      const response = await sessionAgent.get(
        `/verify-email?token=${securityToken}&email=${securityEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      const user = await knex("users").where({ id: securityUserId }).first();
      expect(user.verified).toBe(1);
    });
  });

  describe("Security: Session fixation prevention", () => {
    let fixationUserId: number;
    const fixationEmail = "session-fixation@example.com";
    const fixationToken = "session-fixation-token";

    beforeAll(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Session Fixation Test",
          email: fixationEmail,
          verification_token: fixationToken,
          verified: true,
        })
        .returning("*");
      fixationUserId = user.id;
    });

    afterAll(async () => {
      await knex("users").where({ id: fixationUserId }).delete();
    });

    it("should regenerate session ID after magic link login", async () => {
      await knex("users").where({ id: fixationUserId }).update({
        verification_token: fixationToken,
        magic_link_expires_at: null,
      });

      const agent = createUnauthenticatedSessionAgent();
      const initialResponse = await agent.get("/login");
      const initialCookie = initialResponse.headers["set-cookie"];

      await agent.get(`/magic-link?token=${fixationToken}&email=${fixationEmail}`);

      const dashboardResponse = await agent.get("/dashboard");
      expect(initialCookie).toBeDefined();
      expect(dashboardResponse.status).toBe(200);
    });

    it("should not allow attacker to use victim session", async () => {
      await knex("users").where({ id: fixationUserId }).update({
        verification_token: fixationToken,
        magic_link_expires_at: null,
      });

      const attackerAgent = createUnauthenticatedSessionAgent();
      const victimAgent = createUnauthenticatedSessionAgent();

      await attackerAgent.get("/login");
      await victimAgent.get(`/magic-link?token=${fixationToken}&email=${fixationEmail}`);

      const attackerDashboard = await attackerAgent.get("/dashboard");
      expect(attackerDashboard.status).toBe(302);
      expect(attackerDashboard.headers.location).toBe("/login");

      const victimDashboard = await victimAgent.get("/dashboard");
      expect(victimDashboard.status).toBe(200);
    });
  });

  describe("Security: One-time-use tokens", () => {
    let oneTimeUserId: number;
    const oneTimeEmail = "one-time-token@example.com";
    const oneTimeToken = "one-time-use-token";

    beforeEach(async () => {
      const [user] = await knex("users")
        .insert({
          name: "One Time Token Test",
          email: oneTimeEmail,
          verification_token: oneTimeToken,
          verified: true,
        })
        .returning("*");
      oneTimeUserId = user.id;
    });

    afterEach(async () => {
      await knex("users").where({ id: oneTimeUserId }).delete();
    });

    it("should reject magic link token after it has been used once", async () => {
      const firstAgent = createUnauthenticatedSessionAgent();
      const firstResponse = await firstAgent.get(
        `/magic-link?token=${oneTimeToken}&email=${oneTimeEmail}`,
      );

      expect(firstResponse.status).toBe(302);
      expect(firstResponse.headers.location).toBe("/dashboard");

      const secondAgent = createUnauthenticatedSessionAgent();
      const secondResponse = await secondAgent.get(
        `/magic-link?token=${oneTimeToken}&email=${oneTimeEmail}`,
      );

      expect(secondResponse.status).toBe(302);
      expect(secondResponse.headers.location).toBe("/login");
    });

    it("should reject verification token after it has been used once", async () => {
      await knex("users").where({ id: oneTimeUserId }).update({
        verified: false,
        verification_token: oneTimeToken,
      });

      const firstAgent = createUnauthenticatedSessionAgent();
      const firstResponse = await firstAgent.get(
        `/verify-email?token=${oneTimeToken}&email=${oneTimeEmail}`,
      );

      expect(firstResponse.status).toBe(302);
      expect(firstResponse.headers.location).toBe("/dashboard");

      const user = await knex("users").where({ id: oneTimeUserId }).first();
      expect(user.verified).toBe(1);
      expect(user.verification_token).toBeNull();

      const secondAgent = createUnauthenticatedSessionAgent();
      const secondResponse = await secondAgent.get(
        `/verify-email?token=${oneTimeToken}&email=${oneTimeEmail}`,
      );

      expect(secondResponse.status).toBe(302);
      expect(secondResponse.headers.location).toBe("/login");
    });
  });

  describe("Security: Token timing attack prevention", () => {
    let timingUserId: number;
    const timingEmail = "timing-attack@example.com";
    const timingToken = "correct-token-12345";

    beforeAll(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Timing Attack Test",
          email: timingEmail,
          verification_token: timingToken,
          verified: true,
        })
        .returning("*");
      timingUserId = user.id;
    });

    afterAll(async () => {
      await knex("users").where({ id: timingUserId }).delete();
    });

    it("should reject tokens with similar prefix but wrong value", async () => {
      await knex("users").where({ id: timingUserId }).update({
        verification_token: timingToken,
        magic_link_expires_at: null,
      });

      const response = await request(app).get(
        `/magic-link?token=correct-token-99999&email=${timingEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should reject completely different tokens", async () => {
      await knex("users").where({ id: timingUserId }).update({
        verification_token: timingToken,
        magic_link_expires_at: null,
      });

      const response = await request(app).get(
        `/magic-link?token=completely-different&email=${timingEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });
});
