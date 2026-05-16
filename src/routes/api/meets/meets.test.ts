import { describe, expect, it } from "vite-plus/test";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

// Seeded meet: WRPF AMERICAN PRO on 2024-05-12 with John Haack + Kristy Hawkins.
const MEET = "wrpf/2024-05-12/wrpfamericanpro";

describe("GET /api/meets/:federation/:date/:slug", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get(`/api/meets/${MEET}`);

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return meet data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe(`/api/meets/${MEET}`);
    expect(response.body).toHaveProperty("data");
  });

  it("should return meet with title and results", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}`);
    const data = response.body.data;

    expect(data).toHaveProperty("title");
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("should return meet with date and location", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}`);
    const data = response.body.data;

    expect(data.date).toBe("2024-05-12");
    expect(data.location).toBe("USA-CA");
  });

  it("should return meet results with lifter data", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}`);
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
    const response = await createAuthenticatedApiAgent().get(
      "/api/meets/fake/2024-01-01/missing-meet",
    );

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
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}?sort=${sort}`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 with invalid sort", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}?sort=invalid`);

    expect(response.status).toBe(400);
  });

  it("should return 200 with units=kg", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}?units=kg`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 with invalid units", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}?units=invalid`);

    expect(response.status).toBe(400);
  });

  it("should return 200 with sort and units combined", async () => {
    const response = await createAuthenticatedApiAgent().get(
      `/api/meets/${MEET}?sort=by-wilks&units=kg`,
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return different weight values with units=kg", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}`);
    const kgResponse = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}?units=kg`);

    const defaultFirst = defaultResponse.body.data.results[0];
    const kgFirst = kgResponse.body.data.results[0];

    expect(defaultFirst.lifter).toBe(kgFirst.lifter);
    expect(Number(defaultFirst.squat)).toBeGreaterThan(Number(kgFirst.squat));
  });
});

describe("GET /api/meets/:federation/:date/:slug/highlights", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get(`/api/meets/${MEET}/highlights`);
    expect(response.status).toBe(401);
  });

  it("should return highlights with correct response shape", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}/highlights`);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe(`/api/meets/${MEET}/highlights`);
    expect(response.body.data).toHaveProperty("title");
    expect(response.body.data).toHaveProperty("date");
    expect(response.body.data).toHaveProperty("location");
    expect(response.body.data).toHaveProperty("total_lifters");
    expect(response.body.data).toHaveProperty("weight_classes_contested");
    expect(response.body.data).toHaveProperty("top_by_dots");
    expect(response.body.data).toHaveProperty("top_by_total");
  });

  it("top_by_dots and top_by_total are at most 3 lifters", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}/highlights`);
    expect(response.body.data.top_by_dots.length).toBeLessThanOrEqual(3);
    expect(response.body.data.top_by_total.length).toBeLessThanOrEqual(3);
  });

  it("highlighted lifters expose place, name, total, dots", async () => {
    const response = await createAuthenticatedApiAgent().get(`/api/meets/${MEET}/highlights`);
    const lifter = response.body.data.top_by_dots[0];
    expect(lifter).toHaveProperty("place");
    expect(lifter).toHaveProperty("name");
    expect(lifter).toHaveProperty("total");
    expect(lifter).toHaveProperty("dots");
  });

  it("should accept units=kg query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get(
      `/api/meets/${MEET}/highlights?units=kg`,
    );
    expect(response.status).toBe(200);
  });

  it("should return 400 for invalid units value", async () => {
    const response = await createAuthenticatedApiAgent().get(
      `/api/meets/${MEET}/highlights?units=stones`,
    );
    expect(response.status).toBe(400);
  });

  it("should return 404 for non-existent meet highlights", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/meets/fake/2024-01-01/missing/highlights",
    );
    expect(response.status).toBe(404);
  });
});
