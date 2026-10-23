import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";
import { usernameFor } from "../../../data/csv-normalization";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/users", () => {
  it("returns one non-ASCII athlete profile with capped and open-ended class results", async () => {
    const username = usernameFor("山田太郎");
    const response = await app.request(`/api/users/${username}?units=kg`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      username,
      name: "山田太郎",
      total_entries: 2,
      competition_results: [
        { weight_class_kg: 84, weight_class_over: true, total: 530 },
        { weight_class_kg: 84, weight_class_over: false, total: 500 },
      ],
    });
    const searchResponse = await app.request(`/api/users?search=${encodeURIComponent("山田太郎")}`);
    const search = await searchResponse.json();
    expect(search.pagination.items).toBe(1);
    expect(search.data).toEqual([{ username, name: "山田太郎" }]);
  });

  it("returns the lifter profile + history", async () => {
    const res = await app.request("/api/users/edcoan?units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe("edcoan");
    expect(body.data.total_entries).toBe(2);
    expect(body.data.personal_best.squat).toBe(410);
    expect(body.data.competition_results[0].weight_class_over).toBe(false);
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
    expect(body.data.ranks.dots.out_of).toBe(6);
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
    expect(body.data.progression[0].weight_class_over).toBe(false);
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
