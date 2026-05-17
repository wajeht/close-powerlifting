// Integration tests for every /api/* endpoint. Each test boots a fresh
// Express app with the fixture AppData preloaded, hits the route via
// supertest, and asserts the response shape.

import { beforeEach, describe, expect, it } from "vite-plus/test";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "../../app";
import { createTestContext } from "../../tests/fixtures";

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

describe("GET /api/health-check", () => {
  it("returns 200 once the store is ready", async () => {
    const res = await request(app).get("/api/health-check");
    expect(res.status).toBe(200);
    expect(res.body.data).toBe("ready");
  });
});

describe("GET /api/rankings", () => {
  it("returns lifters sorted by dots descending", async () => {
    const res = await request(app).get("/api/rankings?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.data.metric).toBe("dots");
    expect(res.body.data.rankings).toHaveLength(2);
    expect(res.body.data.rankings[0].username).toBe("edcoan");
    expect(res.body.data.rankings[0].rank).toBe(1);
    expect(res.body.data.rankings[1].rank).toBe(2);
  });

  it("supports a different sort metric", async () => {
    const res = await request(app).get("/api/rankings?metric=wilks&limit=1");
    expect(res.status).toBe(200);
    expect(res.body.data.metric).toBe("wilks");
    expect(res.body.data.rankings[0].username).toBe("edcoan");
  });

  it("paginates via offset/limit", async () => {
    const res = await request(app).get("/api/rankings?limit=1&offset=1");
    expect(res.status).toBe(200);
    expect(res.body.data.rankings[0].rank).toBe(2);
  });
});

describe("GET /api/rankings/:rank", () => {
  it("returns the lifter at that rank", async () => {
    const res = await request(app).get("/api/rankings/1");
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("edcoan");
  });

  it("404s when rank is out of range", async () => {
    const res = await request(app).get("/api/rankings/999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/users/:username", () => {
  it("returns the lifter profile + history", async () => {
    const res = await request(app).get("/api/users/edcoan");
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("edcoan");
    expect(res.body.data.total_entries).toBe(2);
    expect(res.body.data.personal_best.squat).toBe(410);
  });

  it("404s for an unknown username", async () => {
    const res = await request(app).get("/api/users/nobody");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/users?search=", () => {
  it("substring matches case-insensitively over name + username", async () => {
    const res = await request(app).get("/api/users?search=Coan");
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual({ username: "edcoan", name: "Ed Coan" });
  });
});

describe("GET /api/meets and /api/meets/:path", () => {
  it("lists meets sorted by date desc", async () => {
    const res = await request(app).get("/api/meets?limit=10");
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.meets[0].date).toBe("2024-09-01");
    expect(res.body.data.meets[2].date).toBe("2023-11-15");
  });

  it("returns a single meet by its catch-all path", async () => {
    const res = await request(app).get("/api/meets/wrpf/2024-05-12/wrpfamericanpro");
    expect(res.status).toBe(200);
    expect(res.body.data.meet_name).toBe("WRPF AMERICAN PRO");
    expect(res.body.data.results.length).toBeGreaterThan(0);
  });

  it("404s for an unknown meet path", async () => {
    const res = await request(app).get("/api/meets/wrpf/9999-01-01/imaginary");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/federations and /api/federations/:slug", () => {
  it("lists distinct federations", async () => {
    const res = await request(app).get("/api/federations");
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((f: { slug: string }) => f.slug);
    expect(slugs).toContain("wrpf");
    expect(slugs).toContain("usapl");
    expect(slugs).toContain("ipf");
  });

  it("returns the federation + its meets", async () => {
    const res = await request(app).get("/api/federations/wrpf");
    expect(res.status).toBe(200);
    expect(res.body.data.code).toBe("WRPF");
    expect(res.body.data.meet_count).toBe(1);
    expect(res.body.data.meets[0].path).toBe("wrpf/2024-05-12/wrpfamericanpro");
  });
});

describe("GET /api/records", () => {
  it("returns categories filtered by sex + equipment group", async () => {
    const res = await request(app).get("/api/records?sex=M&equipment=raw");
    expect(res.status).toBe(200);
    expect(res.body.data.sex).toBe("M");
    expect(res.body.data.equipment_group).toBe("raw");
    const categories = res.body.data.categories.map((c: { key: string }) => c.key);
    expect(categories).toContain("squat_full_power");
    expect(categories).toContain("total");
  });

  it("supports the all-tested equipment group", async () => {
    const res = await request(app).get("/api/records?sex=F&equipment=all-tested");
    expect(res.status).toBe(200);
    const totalCat = res.body.data.categories.find((c: { key: string }) => c.key === "total");
    // Ruth (60kg, total 530) is the only fixture entry in the all-tested bucket.
    const class60 = totalCat.records.find(
      (r: { weight_class_kg: number }) => r.weight_class_kg === 60,
    );
    expect(class60).not.toBeUndefined();
    expect(class60.lift_value).toBe(530);
  });
});
