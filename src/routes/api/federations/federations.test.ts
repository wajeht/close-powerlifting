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

describe("GET /api/federations", () => {
  it("lists distinct federations with pagination", async () => {
    const res = await request(app).get("/api/federations");
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((f: { slug: string }) => f.slug);
    expect(slugs).toContain("wrpf");
    expect(slugs).toContain("usapl");
    expect(slugs).toContain("ipf");
    expect(res.body.pagination.items).toBe(3);
  });

  it("returns the federation + its meets", async () => {
    const res = await request(app).get("/api/federations/wrpf");
    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe("WRPF");
    expect(res.body.data.meet_count).toBe(1);
    expect(res.body.data.meets[0].path).toBe("wrpf/2024-05-12/wrpfamericanpro");
  });

  it("reports meet counts grouped by year via /stats", async () => {
    const res = await request(app).get("/api/federations/wrpf/stats");
    expect(res.status).toBe(200);
    expect(res.body.data.total_meets).toBe(1);
    expect(res.body.data.meets_by_year[0]).toEqual({ year: 2024, meet_count: 1 });
  });
});
