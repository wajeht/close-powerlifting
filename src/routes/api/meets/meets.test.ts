import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/meets/:meet", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/meets/uspa/1969");

    expect(response.status).toBe(401);
  });

  test("should return 200 for valid meet", async () => {
    const response = await authenticatedRequest().get("/api/meets/uspa/1969");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });

  test("should return 404 for non-existent meet", async () => {
    const response = await authenticatedRequest().get("/api/meets/fake/99999999");

    expect(response.status).toBe(404);
  });
});
