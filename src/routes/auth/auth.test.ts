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

    it("should reject invalid email format", async () => {
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

  describe("GET /verify-email", () => {
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

    it("should reject verification with expired token", async () => {
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      await knex("users").where({ id: verifyUserId }).update({
        verification_token: verifyToken,
        magic_link_expires_at: expiredTime,
        verified: false,
      });

      const response = await request(app).get(
        `/verify-email?token=${verifyToken}&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ id: verifyUserId }).first();
      expect(user.verified).toBe(0);
    });

    it("should accept verification with non-expired token", async () => {
      const validTime = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
      await knex("users").where({ id: verifyUserId }).update({
        verification_token: verifyToken,
        magic_link_expires_at: validTime,
        verified: false,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      const response = await sessionAgent.get(
        `/verify-email?token=${verifyToken}&email=${verifyEmail}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      const user = await knex("users").where({ id: verifyUserId }).first();
      expect(user.verified).toBe(1);
    });
  });

  describe("Admin route access", () => {
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

      const response = await sessionAgent.get("/admin/users");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Manage Users");

      await knex("users").where({ id: adminUser.id }).delete();
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
