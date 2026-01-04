import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/users", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/users");

    expect(response.status).toBe(401);
  });

  test("should redirect to rankings without search query", async () => {
    const response = await authenticatedRequest().get("/api/users");

    expect([302, 308]).toContain(response.status);
    expect(response.header.location).toBe("/api/rankings");
  });

  test("should return results with search query", async () => {
    const response = await authenticatedRequest().get("/api/users?search=haack");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });
});

describe("GET /api/users/:username", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/users/johnhaack");

    expect(response.status).toBe(401);
  });

  test("should return 200 for valid username", async () => {
    const response = await authenticatedRequest().get("/api/users/johnhaack");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });

  test("should return 404 for non-existent username", async () => {
    const response = await authenticatedRequest().get("/api/users/nonexistent-user-xyz-12345");

    expect(response.status).toBe(404);
  });
});
