import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/records", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/records");

    expect(response.status).toBe(401);
  });

  test("should return 200 with authentication", async () => {
    const response = await authenticatedRequest().get("/api/records");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
  });
});

describe("GET /api/records/:equipment", () => {
  test("should return 200 for valid equipment filter", async () => {
    const response = await authenticatedRequest().get("/api/records/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  test("should return 400 for invalid equipment", async () => {
    const response = await authenticatedRequest().get("/api/records/invalid");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/records/:equipment/:sex", () => {
  test("should return 200 for valid equipment and sex", async () => {
    const response = await authenticatedRequest().get("/api/records/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});
