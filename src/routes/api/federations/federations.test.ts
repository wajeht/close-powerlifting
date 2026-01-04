import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/federations", () => {
  test("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/federations");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  test("should return federations data with correct structure", async () => {
    const response = await authenticatedRequest().get("/api/federations");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/federations");
    expect(response.body).toHaveProperty("cache");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  test("should return array of federation meets", async () => {
    const response = await authenticatedRequest().get("/api/federations");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test("should return federation entries with required fields", async () => {
    const response = await authenticatedRequest().get("/api/federations");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("location");
    expect(entry).toHaveProperty("competition");
  });

  test("should return correct data types for federation fields", async () => {
    const response = await authenticatedRequest().get("/api/federations");
    const entry = response.body.data[0];

    expect(typeof entry.fed).toBe("string");
    expect(typeof entry.date).toBe("string");
    expect(typeof entry.location).toBe("string");
    expect(typeof entry.competition).toBe("string");
  });

  test("should return pagination with required fields", async () => {
    const response = await authenticatedRequest().get("/api/federations");
    const pagination = response.body.pagination;

    expect(pagination).toHaveProperty("items");
    expect(pagination).toHaveProperty("pages");
    expect(pagination).toHaveProperty("per_page");
    expect(pagination).toHaveProperty("current_page");
  });

  test("should respect per_page query parameter", async () => {
    const response = await authenticatedRequest().get("/api/federations?per_page=5");

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
  });
});

describe("GET /api/federations/:federation", () => {
  test("should return federation meets with correct structure", async () => {
    const response = await authenticatedRequest().get("/api/federations/usapl");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/federations/usapl");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("should return meets with expected fields", async () => {
    const response = await authenticatedRequest().get("/api/federations/usapl");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("location");
    expect(entry).toHaveProperty("competition");
  });

  test("should return 404 for non-existent federation", async () => {
    const response = await authenticatedRequest().get(
      "/api/federations/nonexistent-federation-xyz",
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
