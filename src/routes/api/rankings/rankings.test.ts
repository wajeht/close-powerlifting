import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/rankings", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/rankings");

    expect(response.status).toBe(401);
  });

  test("should return 200 with valid authentication", async () => {
    const response = await authenticatedRequest().get("/api/rankings");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  test("should return data with expected structure", async () => {
    const response = await authenticatedRequest().get("/api/rankings");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    if (response.body.data.length > 0) {
      const firstEntry = response.body.data[0];
      expect(firstEntry).toHaveProperty("rank");
      expect(firstEntry).toHaveProperty("full_name");
    }
  });

  test("should include pagination in response", async () => {
    const response = await authenticatedRequest().get("/api/rankings?current_page=1&per_page=10");

    expect(response.status).toBe(200);
    expect(response.body.pagination).toHaveProperty("per_page");
    expect(response.body.pagination).toHaveProperty("current_page");
  });
});

describe("GET /api/rankings/filter/:equipment", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/rankings/filter/raw");

    expect(response.status).toBe(401);
  });

  test("should return 200 with valid authentication", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  test("should return 400 for invalid equipment type", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/invalid-equipment");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/rankings/filter/:equipment/:sex", () => {
  test("should return 200 for valid equipment and sex", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  test("should return 400 for invalid sex value", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/invalid");

    expect(response.status).toBe(400);
  });
});

describe("GET /api/rankings/:rank", () => {
  test("should return 200 for valid rank number", async () => {
    const response = await authenticatedRequest().get("/api/rankings/1");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toHaveProperty("rank");
  });

  test("should return 404 for string rank value", async () => {
    const response = await authenticatedRequest().get("/api/rankings/invalid");

    expect(response.status).toBe(404);
  });
});
