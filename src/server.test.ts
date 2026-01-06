import request from "supertest";
import { describe, expect } from "vitest";

import { createApp } from "./app";
import { createContext } from "./context";

const context = createContext();
const { app } = await createApp(context);

describe("server", () => {
  it("GET /health-check returns status ok", async () => {
    const response = await request(app).get("/health-check");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /healthz returns status ok", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("GET /about returns 200", async () => {
    const response = await request(app).get("/about");
    expect(response.status).toBe(200);
  });

  it("GET /nonexistent returns 404", async () => {
    const response = await request(app).get("/nonexistent-route-xyz");
    expect(response.status).toBe(404);
  });
});
