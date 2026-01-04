import { describe, expect, test } from "vitest";

import { unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/health-check", () => {
  test("should return 200 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/health-check");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status");
  });
});
