import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, it } from "vitest";

import { app, knex, extractCsrfToken } from "../../tests/test-setup";

describe("Admin Routes", () => {
  let adminUserId: number;
  let regularUserId: number;
  const adminEmail = "admin-test@example.com";
  const adminMagicToken = "admin-magic-token-123";
  const regularEmail = "regular-test@example.com";
  const regularMagicToken = "regular-magic-token-456";

  beforeAll(async () => {
    const [adminUser] = await knex("users")
      .insert({
        name: "Admin Test User",
        email: adminEmail,
        verification_token: adminMagicToken,
        api_key: "test-admin-key",
        api_call_count: 0,
        api_call_limit: 500,
        admin: true,
        verified: true,
      })
      .returning("*");
    adminUserId = adminUser.id;

    const [regularUser] = await knex("users")
      .insert({
        name: "Regular Test User",
        email: regularEmail,
        verification_token: regularMagicToken,
        api_key: "test-regular-key",
        api_call_count: 50,
        api_call_limit: 100,
        admin: false,
        verified: true,
      })
      .returning("*");
    regularUserId = regularUser.id;
  });

  afterAll(async () => {
    await knex("users").where({ id: adminUserId }).delete();
    await knex("users").where({ id: regularUserId }).delete();
  });

  describe("Protected routes without authentication", () => {
    it("should redirect GET /admin to login", async () => {
      const response = await request(app).get("/admin");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect GET /admin/users to login", async () => {
      const response = await request(app).get("/admin/users");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect GET /admin/cache to login", async () => {
      const response = await request(app).get("/admin/cache");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /admin/users/:id/api-limit to login", async () => {
      const response = await request(app)
        .post("/admin/users/1/api-limit")
        .type("form")
        .send({ api_call_limit: 999 });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /admin/cache/clear to login", async () => {
      const response = await request(app).post("/admin/cache/clear");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /admin/cache/delete to login", async () => {
      const response = await request(app)
        .post("/admin/cache/delete")
        .type("form")
        .send({ key: "test-key" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });
  });

  describe("Protected routes with non-admin user", () => {
    let nonAdminAgent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      // Reset the magic token for the test
      await knex("users")
        .where({ id: regularUserId })
        .update({ verification_token: regularMagicToken });

      nonAdminAgent = request.agent(app);
      // Login via magic link
      await nonAdminAgent.get(`/magic-link?token=${regularMagicToken}&email=${regularEmail}`);
    });

    it("should redirect GET /admin to login for non-admin user", async () => {
      const response = await nonAdminAgent.get("/admin");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect GET /admin/users to login for non-admin user", async () => {
      const response = await nonAdminAgent.get("/admin/users");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect GET /admin/cache to login for non-admin user", async () => {
      const response = await nonAdminAgent.get("/admin/cache");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");
    });

    it("should redirect POST /admin/users/:id/api-limit to login for non-admin user", async () => {
      const response = await nonAdminAgent
        .post(`/admin/users/${regularUserId}/api-limit`)
        .type("form")
        .send({ api_call_limit: 99999 });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ id: regularUserId }).first();
      expect(user.api_call_limit).not.toBe(99999);
    });

    it("should redirect POST /admin/cache/clear to login for non-admin user", async () => {
      await knex("cache").insert({
        key: "non-admin-test-key",
        value: "test-value",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await nonAdminAgent.post("/admin/cache/clear");

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const cacheEntry = await knex("cache").where({ key: "non-admin-test-key" }).first();
      expect(cacheEntry).toBeDefined();

      await knex("cache").where({ key: "non-admin-test-key" }).delete();
    });

    it("should redirect POST /admin/cache/delete to login for non-admin user", async () => {
      await knex("cache").insert({
        key: "non-admin-delete-test",
        value: "test-value",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await nonAdminAgent
        .post("/admin/cache/delete")
        .type("form")
        .send({ key: "non-admin-delete-test" });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const cacheEntry = await knex("cache").where({ key: "non-admin-delete-test" }).first();
      expect(cacheEntry).toBeDefined();

      await knex("cache").where({ key: "non-admin-delete-test" }).delete();
    });
  });

  describe("Protected routes with authentication", () => {
    let agent: ReturnType<typeof request.agent>;

    beforeEach(async () => {
      // Reset the magic token for the test
      await knex("users")
        .where({ id: adminUserId })
        .update({ verification_token: adminMagicToken });

      agent = request.agent(app);
      // Login via magic link
      await agent.get(`/magic-link?token=${adminMagicToken}&email=${adminEmail}`);
    });

    describe("GET /admin", () => {
      it("should redirect to /dashboard", async () => {
        const response = await agent.get("/admin");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/dashboard");
      });
    });

    describe("GET /admin/users", () => {
      it("should render users list", async () => {
        const response = await agent.get("/admin/users");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Manage Users");
        expect(response.text).toContain(adminEmail);
      });

      it("should filter users by search", async () => {
        const response = await agent.get("/admin/users?search=admin-test");

        expect(response.status).toBe(200);
        expect(response.text).toContain(adminEmail);
      });
    });

    describe("POST /admin/users/:id/api-limit", () => {
      it("should update user api_call_limit", async () => {
        const usersPage = await agent.get("/admin/users");
        const csrfToken = extractCsrfToken(usersPage.text);

        const response = await agent
          .post(`/admin/users/${regularUserId}/api-limit`)
          .type("form")
          .send({ api_call_limit: 1000, _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/admin/users");

        const user = await knex("users").where({ id: regularUserId }).first();
        expect(user.api_call_limit).toBe(1000);
      });
    });

    describe("GET /admin/cache", () => {
      it("should render cache view", async () => {
        const response = await agent.get("/admin/cache");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Cache Management");
        expect(response.text).toContain("Search by key");
      });
    });

    describe("POST /admin/cache/clear", () => {
      beforeEach(async () => {
        await knex("cache").insert({
          key: "test-cache-key",
          value: "test-value",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      it("should clear all cache entries", async () => {
        const cachePage = await agent.get("/admin/cache");
        const csrfToken = extractCsrfToken(cachePage.text);

        const response = await agent
          .post("/admin/cache/clear")
          .type("form")
          .send({ _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/admin/cache");

        const afterCount = await knex("cache").count("* as count").first();
        expect(Number(afterCount?.count)).toBe(0);
      });
    });

    describe("POST /admin/cache/delete", () => {
      beforeEach(async () => {
        await knex("cache").del();
        await knex("cache").insert([
          {
            key: "cache-entry-1",
            value: "test-value-1",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            key: "cache-entry-2",
            value: "test-value-2",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      });

      it("should delete a single cache entry", async () => {
        const cachePage = await agent.get("/admin/cache");
        const csrfToken = extractCsrfToken(cachePage.text);

        const response = await agent
          .post("/admin/cache/delete")
          .type("form")
          .send({ key: "cache-entry-1", _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/admin/cache");

        const remaining = await knex("cache").select("key");
        expect(remaining.length).toBe(1);
        expect(remaining[0].key).toBe("cache-entry-2");
      });

      it("should handle non-existent key gracefully", async () => {
        const cachePage = await agent.get("/admin/cache");
        const csrfToken = extractCsrfToken(cachePage.text);

        const response = await agent
          .post("/admin/cache/delete")
          .type("form")
          .send({ key: "non-existent-key", _csrf: csrfToken });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/admin/cache");

        const remaining = await knex("cache").select("key");
        expect(remaining.length).toBe(2);
      });

      it("should reject empty key", async () => {
        const cachePage = await agent.get("/admin/cache");
        const csrfToken = extractCsrfToken(cachePage.text);

        const response = await agent
          .post("/admin/cache/delete")
          .type("form")
          .send({ key: "", _csrf: csrfToken });

        expect(response.status).toBe(302);

        const remaining = await knex("cache").select("key");
        expect(remaining.length).toBe(2);
      });
    });
  });
});
