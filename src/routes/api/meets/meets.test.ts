import { describe, expect, it } from "vitest";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

describe("GET /api/meets/:meet", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/meets/uspa/1969");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return meet data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/meets/uspa/1969");
    expect(response.body).toHaveProperty("data");
  });

  it("should return meet with title and results", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const data = response.body.data;

    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("should return meet with date and location", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const data = response.body.data;

    expect(data).toHaveProperty("date");
    expect(data).toHaveProperty("location");
    expect(typeof data.date).toBe("string");
    expect(typeof data.location).toBe("string");
  });

  it("should return meet results with lifter data", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const results = response.body.data.results;

    expect(results.length).toBeGreaterThan(0);

    const lifter = results[0];
    expect(lifter).toHaveProperty("rank");
    expect(lifter).toHaveProperty("lifter");
    expect(lifter).toHaveProperty("sex");
    expect(lifter).toHaveProperty("equip");
    expect(lifter).toHaveProperty("class");
    expect(lifter).toHaveProperty("weight");
    expect(lifter).toHaveProperty("squat");
    expect(lifter).toHaveProperty("bench");
    expect(lifter).toHaveProperty("deadlift");
    expect(lifter).toHaveProperty("total");
    expect(lifter).toHaveProperty("dots");
  });

  it("should return 404 for non-existent meet", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/fake/99999999");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });

  it("should return 200 with sort=by-wilks", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?sort=by-wilks");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 200 with sort=by-total", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?sort=by-total");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 with invalid sort", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?sort=invalid");

    expect(response.status).toBe(400);
  });

  it("should return 200 with units=kg", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?units=kg");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 with invalid units", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?units=invalid");

    expect(response.status).toBe(400);
  });

  it("should return 200 with sort and units combined", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/meets/uspa/1969?sort=by-wilks&units=kg",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});
