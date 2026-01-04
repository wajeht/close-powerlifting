import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/federations", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/federations");

    expect(response.status).toBe(401);
  });

  test("should return 200 with valid authentication", async () => {
    const response = await authenticatedRequest().get("/api/federations");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });
});

describe("GET /api/federations/:federation", () => {
  test("should return 200 for valid federation", async () => {
    const response = await authenticatedRequest().get("/api/federations/usapl");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  test("should return 404 for non-existent federation", async () => {
    const response = await authenticatedRequest().get(
      "/api/federations/nonexistent-federation-xyz",
    );

    expect(response.status).toBe(404);
  });
});
