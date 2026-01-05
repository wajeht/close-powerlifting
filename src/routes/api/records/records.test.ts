import { describe, expect, it } from "vitest";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

describe("GET /api/records", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/records");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return records data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/records");
    expect(response.body).toHaveProperty("data");
  });

  it("should return array of record categories", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return record categories with title and records array", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
    expect(typeof category.title).toBe("string");
    expect(Array.isArray(category.records)).toBe(true);
  });

  it("should return individual records with lifter information", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records");
    const category = response.body.data[0];

    if (category.records.length > 0) {
      const record = category.records[0];
      expect(typeof record).toBe("object");
    }
  });
});

describe("GET /api/records/:equipment", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/records/raw");

    expect(response.status).toBe(401);
  });

  it("should filter records by raw equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/raw");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should filter records by single equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/single");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/single");
  });

  it("should filter records by multi equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/multi");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/multi");
  });

  it("should filter records by unlimited equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/unlimited");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/unlimited");
  });

  it("should filter records by all-tested", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/all-tested");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/all-tested");
  });

  it("should return records with correct structure when filtered", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
  });

  it("should return 400 for invalid equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/invalid-equipment");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expect(response.body).toHaveProperty("errors");
  });
});

describe("GET /api/records/:equipment/:sex_or_weight_class", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/records/raw/men");

    expect(response.status).toBe(401);
  });

  it("should filter records by equipment and sex (men)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/raw/men");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should filter records by equipment and sex (women)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/women");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should filter records by equipment and weight class (wp-classes)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/unlimited/wp-classes");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/unlimited/wp-classes");
  });

  it("should filter records by equipment and weight class (ipf-classes)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/ipf-classes");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should filter records by equipment and weight class (expanded-classes)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/expanded-classes");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return records with category structure when filtered by sex", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/men");
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
    expect(Array.isArray(category.records)).toBe(true);
  });

  it("should return 404 for invalid sex or weight class", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/invalid");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/records/:equipment/:weight_class/:sex", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get(
      "/api/records/unlimited/wp-classes/women",
    );

    expect(response.status).toBe(401);
  });

  it("should filter records by equipment, weight class, and sex", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/records/unlimited/wp-classes/women",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/records/unlimited/wp-classes/women");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should filter records by equipment, weight class (ipf), and sex (men)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/records/raw/ipf-classes/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return records with category structure", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/records/unlimited/wp-classes/women",
    );
    const category = response.body.data[0];

    expect(category).toHaveProperty("title");
    expect(category).toHaveProperty("records");
    expect(Array.isArray(category.records)).toBe(true);
  });

  it("should return 400 for invalid weight class", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/records/raw/invalid-classes/men",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });

  it("should return 400 for invalid sex in three-param route", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/records/raw/ipf-classes/invalid",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});
