import request from "supertest";
import { describe, expect, it } from "vite-plus/test";

import { createApp } from "./app";
import { createContext } from "./context";

const context = createContext();
const { app } = await createApp(context);

describe("server", () => {
  it("GET /health-check returns status ok with database connected", async () => {
    const response = await request(app).get("/health-check");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("connected");
  });

  it("GET /healthz returns status ok with database connected", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("connected");
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
