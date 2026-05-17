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

describe("GET /api/meets", () => {
  it("lists meets sorted by date desc by default", async () => {
    const res = await request(app).get("/api/meets?per_page=10");
    expect(res.status).toBe(200);
    expect(res.body.pagination.items).toBe(3);
    expect(res.body.data[0].date).toBe("2024-09-01");
    expect(res.body.data[2].date).toBe("2023-11-15");
  });

  it("returns a single meet by its three-part path", async () => {
    const res = await request(app).get("/api/meets/wrpf/2024-05-12/wrpfamericanpro?units=kg");
    expect(res.status).toBe(200);
    expect(res.body.data.meet_name).toBe("WRPF AMERICAN PRO");
    expect(res.body.data.results.length).toBeGreaterThan(0);
  });

  it("404s for an unknown meet path", async () => {
    const res = await request(app).get("/api/meets/wrpf/9999-01-01/imaginary");
    expect(res.status).toBe(404);
  });

  it("returns highlights of the meet", async () => {
    const res = await request(app).get(
      "/api/meets/wrpf/2024-05-12/wrpfamericanpro/highlights?units=kg",
    );
    expect(res.status).toBe(200);
    expect(res.body.data.highlights.best_total.value).toBe(1080);
  });
});
