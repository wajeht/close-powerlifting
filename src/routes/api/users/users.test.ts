import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/users", () => {
  it("returns the lifter profile + history", async () => {
    const res = await app.request("/api/users/edcoan?units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe("edcoan");
    expect(body.data.total_entries).toBe(2);
    expect(body.data.personal_best.squat).toBe(410);
  });

  it("404s for an unknown username", async () => {
    const res = await app.request("/api/users/nobody");
    expect(res.status).toBe(404);
  });

  it("substring search matches case-insensitively over name + username", async () => {
    const res = await app.request("/api/users?search=Coan");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toContainEqual({ username: "edcoan", name: "Ed Coan" });
  });
});

describe("GET /api/users/:username/rank", () => {
  it("reports global rank per metric", async () => {
    const res = await app.request("/api/users/edcoan/rank");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ranks.dots.rank).toBe(1);
    expect(body.data.ranks.dots.out_of).toBe(5);
  });
});

describe("GET /api/users/:username/personal-bests", () => {
  it("groups PBs by equipment", async () => {
    const res = await app.request("/api/users/edcoan/personal-bests?units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    const raw = body.data.by_equipment.find((g: { equipment: string }) => g.equipment === "Raw");
    expect(raw).not.toBeUndefined();
    expect(raw.personal_best.squat).toBe(410);
  });
});

describe("GET /api/users/:username/progression", () => {
  it("emits chronological entries with running PB", async () => {
    const res = await app.request("/api/users/edcoan/progression?units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.progression).toHaveLength(2);
    expect(body.data.progression[0].date).toBe("2024-05-12");
    expect(body.data.progression[0].running_pb.squat).toBe(410);
  });
});

describe("GET /api/users/compare", () => {
  it("compares two athletes side-by-side", async () => {
    const res = await app.request("/api/users/compare?a=edcoan&b=johnsmith1&units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.a.username).toBe("edcoan");
    expect(body.data.b.username).toBe("johnsmith1");
    expect(body.data.deltas.total).toBe(110);
  });
});
