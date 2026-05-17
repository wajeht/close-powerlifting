import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: Express;

beforeEach(async () => {
  const context = createTestContext();
  ({ app } = await createApp(context));
});

describe("GET /api/health-check", () => {
  it("returns 200 once the store is ready", async () => {
    const res = await request(app).get("/api/health-check");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.data).toBe("ready");
  });
});
