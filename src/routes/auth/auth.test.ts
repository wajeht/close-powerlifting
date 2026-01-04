import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, afterEach, it } from "vitest";

import { app, knex } from "../../tests/test-setup";

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

      const agent = request.agent(app);
      await agent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const response = await agent.get("/login");

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
      const agent = request.agent(app);
      const response = await agent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      // Should be able to access dashboard now
      const dashboardResponse = await agent.get("/dashboard");
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

      const agent = request.agent(app);
      await agent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const response = await agent.post("/logout");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const dashboardResponse = await agent.get("/dashboard");
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
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      // Reset token for login (also clear any expired timestamp)
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      agent = request.agent(app);
      await agent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    describe("GET /dashboard", () => {
      it("should render dashboard with user info", async () => {
        const response = await agent.get("/dashboard");

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

        const response = await agent.post("/settings/regenerate-key");

        expect(response.status).toBe(200);

        const afterUser = await knex("users").where({ id: testUserId }).first();
        expect(afterUser.key).not.toBe(beforeKey);
      });
    });
  });

  describe("Profile routes with authentication", () => {
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      // Reset token for login (also clear any expired timestamp)
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      agent = request.agent(app);
      await agent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    describe("GET /settings", () => {
      it("should render settings page", async () => {
        const response = await agent.get("/settings");

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
        const response = await agent.post("/settings").type("form").send({ name: "Updated Name" });

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
        const deleteAgent = request.agent(app);
        await deleteAgent.get(
          `/magic-link?token=${deleteMagicToken}&email=delete-test@example.com`,
        );

        const response = await deleteAgent.post("/settings/delete");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/login");

        const user = await knex("users").where({ id: deleteUserId }).first();
        expect(user.deleted).toBe(1); // SQLite stores booleans as 1/0
      });
    });
  });
});
