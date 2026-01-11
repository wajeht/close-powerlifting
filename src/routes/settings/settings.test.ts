import request from "supertest";
import { describe, expect, beforeAll, afterAll, beforeEach, afterEach, it } from "vitest";

import {
  app,
  knex,
  createUnauthenticatedSessionAgent,
  extractCsrfToken,
} from "../../tests/test-setup";

describe("Settings Routes", () => {
  let testUserId: number;
  const testEmail = "settings-test@example.com";
  const testMagicToken = "settings-magic-token-123";
  const testName = "Settings Test User";

  beforeAll(async () => {
    const [user] = await knex("users")
      .insert({
        name: testName,
        email: testEmail,
        verification_token: testMagicToken,
        api_key: "test-settings-key",
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

  describe("Unauthenticated access", () => {
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

  describe("GET /settings - authenticated", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

    it("should render settings page", async () => {
      const response = await sessionAgent.get("/settings");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Settings");
      expect(response.text).toContain(testEmail);
      expect(response.text).toContain(testName);
    });

    it("should redirect to login if session user is deleted from database", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Temp Settings User",
          email: "temp-settings@example.com",
          verification_token: "temp-settings-token",
          verified: true,
        })
        .returning("*");

      const tempAgent = createUnauthenticatedSessionAgent();
      await tempAgent.get(`/magic-link?token=temp-settings-token&email=temp-settings@example.com`);

      const settingsBefore = await tempAgent.get("/settings");
      expect(settingsBefore.status).toBe(200);

      await knex("users").where({ id: tempUser.id }).delete();

      const settingsAfter = await tempAgent.get("/settings");
      expect(settingsAfter.status).toBe(302);
      expect(settingsAfter.headers.location).toBe("/login");
    });
  });

  describe("POST /settings - update name", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
        name: testName,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

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

    it("should reject empty name", async () => {
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

    it("should update session name after name change", async () => {
      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      await sessionAgent
        .post("/settings")
        .type("form")
        .send({ name: "Updated Session Name", _csrf: csrfToken });

      const settingsPageAfter = await sessionAgent.get("/settings");
      expect(settingsPageAfter.text).toContain("Updated Session Name");
    });

    it("should show success flash after updating name", async () => {
      const settingsPage = await sessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      const updateResponse = await sessionAgent
        .post("/settings")
        .type("form")
        .send({ name: "Flash Test Name", _csrf: csrfToken });

      expect(updateResponse.status).toBe(302);

      const settingsAfter = await sessionAgent.get("/settings");
      expect(settingsAfter.text).toContain("updated successfully");
    });
  });

  describe("POST /settings/regenerate-key", () => {
    let sessionAgent: ReturnType<typeof createUnauthenticatedSessionAgent>;

    beforeEach(async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);
    });

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

    it("should redirect to login if session user is deleted from database", async () => {
      const [tempUser] = await knex("users")
        .insert({
          name: "Temp Regen User",
          email: "temp-regen@example.com",
          verification_token: "temp-regen-token",
          verified: true,
        })
        .returning("*");

      const tempAgent = createUnauthenticatedSessionAgent();
      await tempAgent.get(`/magic-link?token=temp-regen-token&email=temp-regen@example.com`);

      await knex("users").where({ id: tempUser.id }).delete();

      const settingsPage = await tempAgent.get("/settings");
      expect(settingsPage.status).toBe(302);
      expect(settingsPage.headers.location).toBe("/login");
    });

    it("should show success flash after regenerating API key", async () => {
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

  describe("POST /settings/delete", () => {
    it("should delete account and logout", async () => {
      const [deleteUser] = await knex("users")
        .insert({
          name: "Delete Test User",
          email: "delete-settings-test@example.com",
          verification_token: "delete-settings-token",
          verified: true,
        })
        .returning("*");

      const deleteSessionAgent = createUnauthenticatedSessionAgent();
      await deleteSessionAgent.get(
        `/magic-link?token=delete-settings-token&email=delete-settings-test@example.com`,
      );

      const settingsPage = await deleteSessionAgent.get("/settings");
      const csrfToken = extractCsrfToken(settingsPage.text);

      const response = await deleteSessionAgent
        .post("/settings/delete")
        .type("form")
        .send({ _csrf: csrfToken });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/login");

      const user = await knex("users").where({ id: deleteUser.id }).first();
      expect(user).toBeUndefined();
    });
  });

  describe("Session destruction after logout", () => {
    it("should not access settings after logout", async () => {
      await knex("users").where({ id: testUserId }).update({
        verification_token: testMagicToken,
        magic_link_expires_at: null,
      });

      const sessionAgent = createUnauthenticatedSessionAgent();
      await sessionAgent.get(`/magic-link?token=${testMagicToken}&email=${testEmail}`);

      const settingsBefore = await sessionAgent.get("/settings");
      expect(settingsBefore.status).toBe(200);

      const dashboardPage = await sessionAgent.get("/dashboard");
      const csrfToken = extractCsrfToken(dashboardPage.text);
      await sessionAgent.post("/logout").type("form").send({ _csrf: csrfToken });

      const settingsAfter = await sessionAgent.get("/settings");
      expect(settingsAfter.status).toBe(302);
      expect(settingsAfter.headers.location).toBe("/login");
    });
  });
});
