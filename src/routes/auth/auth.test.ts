import request from "supertest";
import bcrypt from "bcryptjs";
import { describe, expect, beforeAll, afterAll, beforeEach, afterEach, it } from "vitest";

import { app, knex } from "../../tests/test-setup";

describe("Auth Routes", () => {
  let testUserId: number;
  const testEmail = "auth-test@example.com";
  const testPassword = "test-password-123";
  const testName = "Auth Test User";

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    const [user] = await knex("users")
      .insert({
        name: testName,
        email: testEmail,
        password: hashedPassword,
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
      expect(response.text).toContain("Login");
    });

    it("should redirect to dashboard if already logged in", async () => {
      const agent = request.agent(app);
      await agent.post("/login").type("form").send({ email: testEmail, password: testPassword });

      const response = await agent.get("/login");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");
    });
  });

  describe("POST /login", () => {
    it("should redirect to /dashboard on successful login", async () => {
      const agent = request.agent(app);

      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");
    });

    it("should redirect admin users to /dashboard", async () => {
      const hashedPassword = await bcrypt.hash("admin-password", 10);
      const [adminUser] = await knex("users")
        .insert({
          name: "Admin User",
          email: "admin-login-test@example.com",
          password: hashedPassword,
          key: "test-admin-login-key",
          admin: true,
          verified: true,
        })
        .returning("*");

      const agent = request.agent(app);
      const response = await agent
        .post("/login")
        .type("form")
        .send({ email: "admin-login-test@example.com", password: "admin-password" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/dashboard");

      await knex("users").where({ id: adminUser.id }).delete();
    });

    it("should redirect back to login with invalid credentials", async () => {
      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: testEmail, password: "wrong-password" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect back to login for non-existent user", async () => {
      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: "nonexistent@example.com", password: "password" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect back to login for unverified user", async () => {
      const hashedPassword = await bcrypt.hash("unverified-password", 10);
      const [unverifiedUser] = await knex("users")
        .insert({
          name: "Unverified User",
          email: "unverified-test@example.com",
          password: hashedPassword,
          verified: false,
        })
        .returning("*");

      const response = await request(app)
        .post("/login")
        .type("form")
        .send({ email: "unverified-test@example.com", password: "unverified-password" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      await knex("users").where({ id: unverifiedUser.id }).delete();
    });
  });

  describe("POST /logout", () => {
    it("should logout and redirect to login", async () => {
      const agent = request.agent(app);
      await agent.post("/login").type("form").send({ email: testEmail, password: testPassword });

      const response = await agent.post("/logout");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const dashboardResponse = await agent.get("/dashboard");
      expect(dashboardResponse.status).toBe(302);
      expect(dashboardResponse.headers.location).toBe("/login");
    });
  });

  describe("GET /register", () => {
    it("should render registration page", async () => {
      const response = await request(app).get("/register");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Get API Key");
    });
  });

  describe("POST /register", () => {
    afterEach(async () => {
      await knex("users").where({ email: "new-register@example.com" }).delete();
    });

    it("should create new user and redirect", async () => {
      const response = await request(app).post("/register").type("form").send({
        email: "new-register@example.com",
        name: "New User",
        password: "newpassword123",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/register");

      const user = await knex("users").where({ email: "new-register@example.com" }).first();
      expect(user).toBeDefined();
      expect(user.name).toBe("New User");
      expect(user.password).toBeDefined();
    });

    it("should reject duplicate email", async () => {
      const response = await request(app).post("/register").type("form").send({
        email: testEmail,
        name: "Duplicate User",
        password: "password123",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/register");
    });

    it("should reject short password", async () => {
      const response = await request(app).post("/register").type("form").send({
        email: "short-password@example.com",
        name: "Short Password User",
        password: "short",
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/register");
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

    it("should redirect POST /settings/password to login", async () => {
      const response = await request(app).post("/settings/password").type("form").send({
        current_password: "test",
        new_password: "newpassword123",
        confirm_password: "newpassword123",
      });

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
      agent = request.agent(app);
      await agent.post("/login").type("form").send({ email: testEmail, password: testPassword });
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
      agent = request.agent(app);
      await agent.post("/login").type("form").send({ email: testEmail, password: testPassword });
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

    describe("POST /settings/password", () => {
      afterEach(async () => {
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        await knex("users").where({ id: testUserId }).update({ password: hashedPassword });
      });

      it("should change password with valid current password", async () => {
        const response = await agent.post("/settings/password").type("form").send({
          current_password: testPassword,
          new_password: "newpassword123",
          confirm_password: "newpassword123",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/settings");

        const user = await knex("users").where({ id: testUserId }).first();
        const isNewPasswordValid = await bcrypt.compare("newpassword123", user.password);
        expect(isNewPasswordValid).toBe(true);
      });

      it("should reject incorrect current password", async () => {
        const response = await agent.post("/settings/password").type("form").send({
          current_password: "wrong-password",
          new_password: "newpassword123",
          confirm_password: "newpassword123",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/settings");

        const user = await knex("users").where({ id: testUserId }).first();
        const isOldPasswordStillValid = await bcrypt.compare(testPassword, user.password);
        expect(isOldPasswordStillValid).toBe(true);
      });

      it("should reject mismatched passwords", async () => {
        const response = await agent.post("/settings/password").type("form").send({
          current_password: testPassword,
          new_password: "newpassword123",
          confirm_password: "differentpassword",
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/settings/password");
      });
    });

    describe("POST /settings/delete", () => {
      let deleteUserId: number;

      beforeEach(async () => {
        const hashedPassword = await bcrypt.hash("delete-password", 10);
        const [user] = await knex("users")
          .insert({
            name: "Delete Test User",
            email: "delete-test@example.com",
            password: hashedPassword,
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
        await deleteAgent
          .post("/login")
          .type("form")
          .send({ email: "delete-test@example.com", password: "delete-password" });

        const response = await deleteAgent.post("/settings/delete");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/login");

        const user = await knex("users").where({ id: deleteUserId }).first();
        expect(user.deleted_at).not.toBeNull();
      });
    });
  });
});
