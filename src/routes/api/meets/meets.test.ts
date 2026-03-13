import { describe, expect, it } from "vite-plus/test";

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

  it.each([
    "by-dots",
    "by-wilks",
    "by-wilks2020",
    "by-glossbrenner",
    "by-goodlift",
    "by-ipf-points",
    "by-mcculloch",
    "by-total",
    "by-ah",
    "by-nasa",
    "by-reshel",
    "by-schwartz-malone",
    "by-division",
  ])("should return 200 with sort=%s", async (sort) => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/uspa/1969?sort=${sort}`);

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

  it("should return correct lifter data in default response", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const first = response.body.data.results[0];

    expect(first.lifter).toContain("Alex Maher");
    expect(first.rank).toBe("1");
    expect(first.squat).toBe("451.9");
    expect(first.bench).toBe("253.5");
    expect(first.deadlift).toBe("766.1");
    expect(first.total).toBe("1471.6");
  });

  it("should return different sort order with sort=by-total", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const totalResponse = await createAuthenticatedApiAgent().get(
      "/api/meets/uspa/1969?sort=by-total",
    );

    expect(defaultResponse.body.data.results[0].lifter).toContain("Alex Maher");
    expect(totalResponse.body.data.results[0].lifter).toContain("Joseph Ferguson");
  });

  it("should return wilks column instead of dots when sorted by wilks", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const wilksResponse = await createAuthenticatedApiAgent().get(
      "/api/meets/uspa/1969?sort=by-wilks",
    );

    const defaultFirst = defaultResponse.body.data.results[0];
    const wilksFirst = wilksResponse.body.data.results[0];
    expect(defaultFirst.dots).toBe("478.88");
    expect(wilksFirst.wilks).toBe("475.63");
  });

  it("should return different weight values with units=kg", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969");
    const kgResponse = await createAuthenticatedApiAgent().get("/api/meets/uspa/1969?units=kg");

    const defaultFirst = defaultResponse.body.data.results[0];
    const kgFirst = kgResponse.body.data.results[0];

    expect(defaultFirst.lifter).toContain("Alex Maher");
    expect(kgFirst.lifter).toContain("Alex Maher");
    expect(defaultFirst.squat).toBe("451.9");
    expect(kgFirst.squat).toBe("205");
    expect(defaultFirst.weight).toBe("165.3");
    expect(kgFirst.weight).toBe("75");
  });
});
