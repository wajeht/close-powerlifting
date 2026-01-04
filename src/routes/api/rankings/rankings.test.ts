import { describe, expect } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/rankings", () => {
  it("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/rankings");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.message).toContain("Authorization");
  });

  it("should return rankings data with correct structure", async () => {
    const response = await authenticatedRequest().get("/api/rankings");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/rankings");
    expect(response.body).toHaveProperty("cache");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  it("should return array of ranking entries", async () => {
    const response = await authenticatedRequest().get("/api/rankings");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return ranking entries with required fields", async () => {
    const response = await authenticatedRequest().get("/api/rankings");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("full_name");
    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("user_profile");
    expect(entry).toHaveProperty("country");
    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("sex");
    expect(entry).toHaveProperty("equip");
    expect(entry).toHaveProperty("body_weight");
    expect(entry).toHaveProperty("weight_class");
    expect(entry).toHaveProperty("squat");
    expect(entry).toHaveProperty("bench");
    expect(entry).toHaveProperty("deadlift");
    expect(entry).toHaveProperty("total");
    expect(entry).toHaveProperty("dots");
  });

  it("should return correct data types for ranking fields", async () => {
    const response = await authenticatedRequest().get("/api/rankings");
    const entry = response.body.data[0];

    expect(typeof entry.rank).toBe("number");
    expect(typeof entry.full_name).toBe("string");
    expect(typeof entry.dots).toBe("number");
    expect(typeof entry.total).toBe("number");
    expect(typeof entry.squat).toBe("number");
    expect(typeof entry.bench).toBe("number");
    expect(typeof entry.deadlift).toBe("number");
    expect(typeof entry.body_weight).toBe("number");
  });

  it("should return pagination with required fields", async () => {
    const response = await authenticatedRequest().get("/api/rankings");
    const pagination = response.body.pagination;

    expect(pagination).toHaveProperty("items");
    expect(pagination).toHaveProperty("pages");
    expect(pagination).toHaveProperty("per_page");
    expect(pagination).toHaveProperty("current_page");
    expect(pagination).toHaveProperty("last_page");
    expect(pagination).toHaveProperty("first_page");
    expect(pagination).toHaveProperty("from");
    expect(pagination).toHaveProperty("to");
  });

  it("should accept per_page query parameter", async () => {
    const response = await authenticatedRequest().get("/api/rankings?per_page=5");

    expect(response.status).toBe(200);
    expect(Number(response.body.pagination.per_page)).toBe(5);
  });

  it("should accept current_page query parameter", async () => {
    const response = await authenticatedRequest().get("/api/rankings?current_page=2");

    expect(response.status).toBe(200);
    expect(Number(response.body.pagination.current_page)).toBe(2);
  });

  it("should return entries sorted by DOTS score by default", async () => {
    const response = await authenticatedRequest().get("/api/rankings");
    const entries = response.body.data;

    if (entries.length > 1) {
      expect(entries[0].dots).toBeGreaterThanOrEqual(entries[1].dots);
    }
  });
});

describe("GET /api/rankings/filter/:equipment", () => {
  it("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/rankings/filter/raw");

    expect(response.status).toBe(401);
  });

  it("should filter by raw equipment", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should filter by wraps equipment", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/wraps");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid equipment", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/invalid-equipment");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expect(response.body).toHaveProperty("errors");
  });
});

describe("GET /api/rankings/filter/:equipment/:sex", () => {
  it("should filter by equipment and sex (men)", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should filter by equipment and sex (women)", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/women");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid sex", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/invalid");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings/filter/:equipment/:sex/:weight_class", () => {
  it("should filter by equipment, sex, and weight class", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/women/75");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should return rankings data with correct structure", async () => {
    const response = await authenticatedRequest().get("/api/rankings/filter/raw/women/75");

    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
    expect(response.body).toHaveProperty("cache");
  });
});

describe("GET /api/rankings/:rank", () => {
  it("should return single ranking entry by rank number", async () => {
    const response = await authenticatedRequest().get("/api/rankings/1");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toHaveProperty("rank");
    expect(response.body.data.rank).toBe(1);
  });

  it("should return ranking with all required fields", async () => {
    const response = await authenticatedRequest().get("/api/rankings/1");
    const entry = response.body.data;

    expect(entry).toHaveProperty("full_name");
    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("total");
    expect(entry).toHaveProperty("dots");
    expect(entry).toHaveProperty("squat");
    expect(entry).toHaveProperty("bench");
    expect(entry).toHaveProperty("deadlift");
  });

  it("should return 404 for non-numeric rank", async () => {
    const response = await authenticatedRequest().get("/api/rankings/invalid");

    expect(response.status).toBe(404);
  });

  it("should return 404 for very large rank number", async () => {
    const response = await authenticatedRequest().get("/api/rankings/999999999");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
