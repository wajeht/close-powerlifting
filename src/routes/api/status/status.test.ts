import { describe, expect } from "vitest";

import { createUnauthenticatedApiAgent } from "../../../tests/test-setup";

describe("GET /api/status", () => {
  it("should return 200 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");

    expect(response.status).toBe(200);
  });

  it("should return status data with correct structure", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/status");
    expect(response.body).toHaveProperty("cache");
    expect(response.body).toHaveProperty("data");
  });

  it("should return status with server version", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");
    const data = response.body.data;

    expect(data).toHaveProperty("server_version");
    expect(typeof data.server_version).toBe("string");
    expect(data.server_version.length).toBeGreaterThan(0);
  });

  it("should return status with meets count", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");
    const data = response.body.data;

    expect(data).toHaveProperty("meets");
    expect(typeof data.meets).toBe("string");
  });

  it("should return status with federations list", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");
    const data = response.body.data;

    expect(data).toHaveProperty("federations");
    expect(Array.isArray(data.federations)).toBe(true);
    expect(data.federations.length).toBeGreaterThan(0);
  });

  it("should return federation status with required fields", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");
    const federation = response.body.data.federations[0];

    expect(federation).toHaveProperty("name");
    expect(federation).toHaveProperty("meetsentered");
    expect(federation).toHaveProperty("status");
    expect(federation).toHaveProperty("newmeetdetection");
    expect(federation).toHaveProperty("resultsformat");
    expect(federation).toHaveProperty("easeofimport");
    expect(federation).toHaveProperty("maintainers");
  });

  it("should return federation with correct data types", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/status");
    const federation = response.body.data.federations[0];

    expect(typeof federation.name).toBe("string");
    expect(typeof federation.meetsentered).toBe("string");
    expect(typeof federation.status).toBe("string");
  });
});
