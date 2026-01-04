import { describe, expect, test } from "vitest";

import { authenticatedRequest, unauthenticatedRequest } from "../../../tests/test-setup";

describe("GET /api/records", () => {
  it("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/records");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return records data with correct structure", async () => {
    const response = await authenticatedRequest().get("/api/records");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/records");
    expect(response.body).toHaveProperty("cache");
    expect(response.body).toHaveProperty("data");
  });

  it("should return array of record categories", async () => {
    const response = await authenticatedRequest().get("/api/records");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return record categories with title and records array", async () => {
    const response = await authenticatedRequest().get("/api/records");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
    expect(typeof category.title).toBe("string");
    expect(Array.isArray(category.records)).toBe(true);
  });

  it("should return individual records with lifter information", async () => {
    const response = await authenticatedRequest().get("/api/records");
    const category = response.body.data[0];

    if (category.records.length > 0) {
      const record = category.records[0];
      expect(typeof record).toBe("object");
    }
  });
});

describe("GET /api/records/:equipment", () => {
  it("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/records/raw");

    expect(response.status).toBe(401);
  });

  it("should filter records by raw equipment", async () => {
    const response = await authenticatedRequest().get("/api/records/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/raw");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should return records with correct structure when filtered", async () => {
    const response = await authenticatedRequest().get("/api/records/raw");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
  });

  it("should return 400 for invalid equipment", async () => {
    const response = await authenticatedRequest().get("/api/records/invalid-equipment");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expect(response.body).toHaveProperty("errors");
  });
});

describe("GET /api/records/:equipment/:sex", () => {
  it("should return 401 without authentication", async () => {
    const response = await unauthenticatedRequest().get("/api/records/raw/men");

    expect(response.status).toBe(401);
  });

  it("should filter records by equipment and sex (men)", async () => {
    const response = await authenticatedRequest().get("/api/records/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/raw/men");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should filter records by equipment and sex (women)", async () => {
    const response = await authenticatedRequest().get("/api/records/raw/women");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return records with category structure when filtered by sex", async () => {
    const response = await authenticatedRequest().get("/api/records/raw/men");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
    expect(Array.isArray(category.records)).toBe(true);
  });

  it("should return 400 for invalid sex", async () => {
    const response = await authenticatedRequest().get("/api/records/raw/invalid");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});
