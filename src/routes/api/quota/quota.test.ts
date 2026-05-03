import { describe, expect, it } from "vite-plus/test";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
  knex,
  testApiKey,
} from "../../../tests/test-setup";

describe("GET /api/quota", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/quota");

    expect(response.status).toBe(401);
  });

  it("should return quota information for an authenticated user", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/quota");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/quota");
    expect(response.body.data).toMatchObject({
      limit: expect.any(Number),
      used: expect.any(Number),
      remaining: expect.any(Number),
      reset_at: expect.any(String),
    });
    expect(response.body.data).not.toHaveProperty("admin");
    expect(response.body.data.remaining).toBe(response.body.data.limit - response.body.data.used);
  });

  it("should return reset_at as the start of the next UTC month", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/quota");

    const resetAt = new Date(response.body.data.reset_at);
    const now = new Date();
    const expected = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    expect(resetAt.toISOString()).toBe(expected.toISOString());
  });

  it("should not increment the caller's api_call_count", async () => {
    const before = await knex("users").where({ api_key: testApiKey }).first();

    await createAuthenticatedApiAgent().get("/api/quota");

    const after = await knex("users").where({ id: before.id }).first();

    expect(after.api_call_count).toBe(before.api_call_count);
  });
});
