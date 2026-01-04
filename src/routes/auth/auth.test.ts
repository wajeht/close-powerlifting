import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, afterEach, it } from "vitest";

import {
  app,
  knex,
  createUnauthenticatedSessionAgent,
  createUnauthenticatedApiAgent,
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
        key: "test-auth-key",
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
      // Reset token for login (also clear any expired timestamp)
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
      const response = await request(app).post("/login").type("form").send({ email: testEmail });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect back to login for non-existent user", async () => {
      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: "nonexistent@example.com" });

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

      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: "unverified-test@example.com" });

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

      // Should be able to access dashboard now
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
      // Set expired timestamp
      const expiredTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
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
      // Reset token for login (also clear any expired timestamp)
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const response = await sessionAgent.post("/logout");

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
      const response = await request(app).post("/login").type("form").send({
        email: "new-user@example.com",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ email: "new-user@example.com" }).first();
      expect(user).toBeDefined();
      expect(user.name).toBe("New User"); // extracted from email
      expect(user.verification_token).toBeDefined();
      expect(user.verified).toBe(0); // SQLite stores booleans as 0/1
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
      // Reset token for login (also clear any expired timestamp)
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
        const beforeKey = beforeUser.key;

        const response = await sessionAgent.post("/settings/regenerate-key");

        expect(response.status).toBe(200);

        const afterUser = await knex("users").where({ id: testUserId }).first();
        expect(afterUser.key).not.toBe(beforeKey);
      });
    });
  });

  describe("Profile routes with authentication", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      // Reset token for login (also clear any expired timestamp)
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
        const response = await sessionAgent
          .post("/settings")
          .type("form")
          .send({ name: "Updated Name" });

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

      afterEach(async () => {
        await knex("users").where({ id: deleteUserId }).delete();
      });

      it("should soft delete account and logout", async () => {
        const deleteSessionAgent = createUnauthenticatedSessionAgent();
        await deleteSessionAgent.get(
          `/magic-link?token=${deleteMagicToken}&email=delete-test@example.com`,
        );

        const response = await deleteSessionAgent.post("/settings/delete");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/login");

        const user = await knex("users").where({ id: deleteUserId }).first();
        expect(user.deleted).toBe(1); // SQLite stores booleans as 1/0
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

      // Verify user is marked as verified in database
      const user = await knex("users").where({ id: verifyUserId }).first();
      expect(user.verified).toBe(1);
      expect(user.verification_token).toBeNull();

      // Should be able to access dashboard
      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain("Dashboard");
    });

    it("should show API key on dashboard after verification", async () => {
      const sessionAgent = createUnauthenticatedSessionAgent();

      await sessionAgent.get(`/verify-email?token=${verifyToken}&email=${verifyEmail}`);

      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.text).toContain("Your API Key");
      expect(dashboardResponse.text).toContain("Copy this key now");
    });

    it("should clear API key from session after first dashboard view", async () => {
      const sessionAgent = createUnauthenticatedSessionAgent();

      await sessionAgent.get(`/verify-email?token=${verifyToken}&email=${verifyEmail}`);

      // First view shows API key
      const firstView = await sessionAgent.get("/dashboard");
      expect(firstView.text).toContain("Your API Key");

      // Second view should not show API key
      const secondView = await sessionAgent.get("/dashboard");
      expect(secondView.text).not.toContain("Your API Key");
    });

    it("should reject verification with invalid token", async () => {
      const response = await request(app).get(
        `/verify-email?token=wrong-token&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      // User should still be unverified
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

  describe("POST /api/login - API endpoint", () => {
    const apiAgent = createUnauthenticatedApiAgent();

    afterEach(async () => {
      await knex("users").where({ email: "api-new-user@example.com" }).delete();
    });

    it("should create new user and return 201 for non-existent email", async () => {
      const response = await apiAgent
        .post("/api/login")
        .send({ email: "api-new-user@example.com" });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Check your email to verify your account");

      const user = await knex("users").where({ email: "api-new-user@example.com" }).first();
      expect(user).toBeDefined();
      expect(user.name).toBe("Api New User");
      expect(user.verified).toBe(0);
    });

    it("should send magic link for verified user", async () => {
      const response = await apiAgent.post("/api/login").send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Check your email for a magic link");
    });

    it("should resend verification for unverified user", async () => {
      const [unverifiedUser] = await knex("users")
        .insert({
          name: "Unverified API User",
          email: "unverified-api@example.com",
          verification_token: "unverified-api-token",
          verified: false,
        })
        .returning("*");

      const response = await apiAgent
        .post("/api/login")
        .send({ email: "unverified-api@example.com" });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("verify your email first");

      await knex("users").where({ id: unverifiedUser.id }).delete();
    });

    it("should reject invalid email format", async () => {
      const response = await apiAgent.post("/api/login").send({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("fail");
    });
  });

  describe("POST /api/verify-email - API endpoint", () => {
    const apiAgent = createUnauthenticatedApiAgent();
    let apiVerifyUserId: number;
    const apiVerifyEmail = "api-verify@example.com";
    const apiVerifyToken = "api-verify-token";

    beforeEach(async () => {
      const [user] = await knex("users")
        .insert({
          name: "API Verify User",
          email: apiVerifyEmail,
          verification_token: apiVerifyToken,
          verified: false,
        })
        .returning("*");
      apiVerifyUserId = user.id;
    });

    afterEach(async () => {
      await knex("users").where({ id: apiVerifyUserId }).delete();
    });

    it("should verify email and return API key", async () => {
      const response = await apiAgent
        .post("/api/verify-email")
        .send({ email: apiVerifyEmail, token: apiVerifyToken });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data[0].email).toBe(apiVerifyEmail);
      expect(response.body.data[0].apiKey).toBeDefined();

      const user = await knex("users").where({ id: apiVerifyUserId }).first();
      expect(user.verified).toBe(1);
    });

    it("should reject verification with invalid token", async () => {
      const response = await apiAgent
        .post("/api/verify-email")
        .send({ email: apiVerifyEmail, token: "wrong-token" });

      expect(response.status).toBe(422);
      expect(response.body.status).toBe("fail");
    });

    it("should reject verification for already verified user", async () => {
      await knex("users").where({ id: apiVerifyUserId }).update({ verified: true });

      const response = await apiAgent
        .post("/api/verify-email")
        .send({ email: apiVerifyEmail, token: apiVerifyToken });

      expect(response.status).toBe(422);
      expect(response.body.status).toBe("fail");
    });

    it("should reject verification for non-existent user", async () => {
      const response = await apiAgent
        .post("/api/verify-email")
        .send({ email: "nonexistent@example.com", token: "any-token" });

      expect(response.status).toBe(422);
      expect(response.body.status).toBe("fail");
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

      // Verify logged in
      const dashboardBefore = await sessionAgent.get("/dashboard");
      expect(dashboardBefore.status).toBe(200);

      // Delete user from database
      await knex("users").where({ id: tempUser.id }).delete();

      // Should redirect to login
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

      // Verify magic link login worked
      expect(magicLinkResponse.status).toBe(302);
      expect(magicLinkResponse.headers.location).toBe("/dashboard");

      // Verify can access dashboard (regular user auth)
      const dashboardResponse = await sessionAgent.get("/dashboard");
      expect(dashboardResponse.status).toBe(200);

      // Admin can access /admin/users page
      const response = await sessionAgent.get("/admin/users");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Manage Users");

      await knex("users").where({ id: adminUser.id }).delete();
    });
  });

  describe("Validation edge cases", () => {
    it("POST /login should reject invalid email format", async () => {
      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: "not-an-email" });

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

      const response = await sessionAgent.post("/settings").type("form").send({ name: "" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/settings");

      // Name should not have changed
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

      // Make multiple requests with same session
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

      await sessionAgent.post("/settings").type("form").send({ name: "Updated Session Name" });

      // Session should reflect new name in subsequent requests
      const settingsPage = await sessionAgent.get("/settings");
      expect(settingsPage.text).toContain("Updated Session Name");

      // Restore original name
      await knex("users").where({ id: testUserId }).update({ name: testName });
    });
  });
});
