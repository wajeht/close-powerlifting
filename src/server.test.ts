import request from "supertest";
import { describe, expect, test } from "vitest";

import { createApp } from "./app";

const { app } = createApp();

describe("server", () => {
  test("GET /health-check returns status ok", async () => {
    const response = await request(app).get("/health-check");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  test("GET /healthz returns status ok", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  test("GET /about returns 200", async () => {
    const response = await request(app).get("/about");
    expect(response.status).toBe(200);
  });

  test("GET /nonexistent returns 404", async () => {
    const response = await request(app).get("/nonexistent-route-xyz");
    expect(response.status).toBe(404);
  });
});
