import { describe, expect, it } from "vite-plus/test";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

describe("GET /api/federations", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/federations");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return federations data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/federations");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  it("should return array of federation meets", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return federation entries with required fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("location");
    expect(entry).toHaveProperty("competition");
  });

  it("should return correct data types for federation fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations");
    const entry = response.body.data[0];

    expect(typeof entry.fed).toBe("string");
    expect(typeof entry.date).toBe("string");
    expect(typeof entry.location).toBe("string");
    expect(typeof entry.competition).toBe("string");
  });

  it("should return pagination with required fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations");
    const pagination = response.body.pagination;

    expect(pagination).toHaveProperty("items");
    expect(pagination).toHaveProperty("pages");
    expect(pagination).toHaveProperty("per_page");
    expect(pagination).toHaveProperty("current_page");
  });

  it("should respect per_page query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations?per_page=5");

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
  });
});

describe("GET /api/federations/:federation", () => {
  it("should return federation meets with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations/usapl");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.request_url).toBe("/api/federations/usapl");
    expect(response.body).toHaveProperty("data");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should return meets with expected fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations/usapl");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("location");
    expect(entry).toHaveProperty("competition");
  });

  it("should return 404 for non-existent federation", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/federations/nonexistent-federation-xyz",
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/federations/:federation/stats", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/federations/usapl/stats");
    expect(response.status).toBe(401);
  });

  it("should return federation stats with correct response shape", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations/usapl/stats");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/federations/usapl/stats");
    expect(response.body.data).toHaveProperty("federation", "usapl");
    expect(response.body.data).toHaveProperty("total_meets");
    expect(response.body.data).toHaveProperty("earliest_year");
    expect(response.body.data).toHaveProperty("latest_year");
    expect(response.body.data).toHaveProperty("meets_by_year");
    expect(Array.isArray(response.body.data.meets_by_year)).toBe(true);
  });

  it("meets_by_year entries have year and meets count", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations/usapl/stats");
    if (response.body.data.meets_by_year.length > 0) {
      const entry = response.body.data.meets_by_year[0];
      expect(entry).toHaveProperty("year");
      expect(entry).toHaveProperty("meets");
      expect(typeof entry.year).toBe("number");
      expect(typeof entry.meets).toBe("number");
    }
  });

  it("meets_by_year is sorted ascending by year", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/federations/usapl/stats");
    const entries = response.body.data.meets_by_year as Array<{ year: number }>;
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i]!.year).toBeGreaterThan(entries[i - 1]!.year);
    }
  });
});
