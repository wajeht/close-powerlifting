import { describe, expect, test } from "vitest";

import { unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/health-check", () => {
  test("should return 200 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/health-check");

    expect(response.status).toBe(200);
  });

  test("should return health check data with correct structure", async () => {
    const response = await unauthenticatedRequest().get("/api/health-check");

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("ok");
    expect(response.body.request_url).toBe("/api/health-check");
    expect(response.body).toHaveProperty("data");
  });

  test("should return empty data array", async () => {
    const response = await unauthenticatedRequest().get("/api/health-check");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(0);
  });
});
