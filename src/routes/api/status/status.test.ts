import { describe, expect, test } from "vitest";

import { unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/status", () => {
  test("should return 200 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/status");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });

  test("should have expected response structure", async () => {
    const response = await unauthenticatedRequest().get("/api/status");

    expect(response.body).toHaveProperty("status");
    expect(response.body).toHaveProperty("request_url");
    expect(response.body).toHaveProperty("message");
  });
});
