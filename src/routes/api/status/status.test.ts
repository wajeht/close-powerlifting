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

describe("GET /api/status", () => {
  it("returns counts from the loaded snapshot", async () => {
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.lifters).toBe(5);
    expect(res.body.data.meets).toBe(3);
    expect(res.body.data.entries).toBe(6);
    expect(res.body.data.federations).toBe(3);
  });
});
