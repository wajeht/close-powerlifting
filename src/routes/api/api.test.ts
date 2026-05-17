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
    expect(res.body.status).toBe("success");
    expect(res.body.data.data).toBe("ready");
  });
});

describe("GET /api/rankings", () => {
  it("returns lifters sorted by dots descending with pagination", async () => {
    const res = await request(app).get("/api/rankings?per_page=2&units=kg");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].username).toBe("edcoan");
    expect(res.body.data[0].rank).toBe(1);
    expect(res.body.pagination.current_page).toBe(1);
    expect(res.body.pagination.per_page).toBe(2);
    expect(res.body.pagination.items).toBe(5);
  });

  it("paginates via current_page + per_page", async () => {
    const res = await request(app).get("/api/rankings?per_page=1&current_page=2&units=kg");
    expect(res.status).toBe(200);
    expect(res.body.data[0].rank).toBe(2);
  });
});

describe("GET /api/rankings/filter", () => {
  it("filters by equipment and sex", async () => {
    const res = await request(app).get("/api/rankings/filter/raw/men?units=kg");
    expect(res.status).toBe(200);
    const usernames = res.body.data.map((r: { username: string }) => r.username);
    expect(usernames).toContain("edcoan");
    expect(usernames).not.toContain("johnsmith1"); // Single-ply, not Raw
  });

  it("supports custom sort metric in the deepest filter route", async () => {
    const res = await request(app).get(
      "/api/rankings/filter/raw/men/100/2024/full-power/by-total?units=kg",
    );
    expect(res.status).toBe(200);
    expect(res.body.data[0].username).toBe("edcoan");
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

describe("GET /api/users", () => {
  it("returns the lifter profile + history", async () => {
    const res = await request(app).get("/api/users/edcoan?units=kg");
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("edcoan");
    expect(res.body.data.total_entries).toBe(2);
    expect(res.body.data.personal_best.squat).toBe(410);
  });

  it("404s for an unknown username", async () => {
    const res = await request(app).get("/api/users/nobody");
    expect(res.status).toBe(404);
  });

  it("substring search matches case-insensitively over name + username", async () => {
    const res = await request(app).get("/api/users?search=Coan");
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual({ username: "edcoan", name: "Ed Coan" });
  });
});

describe("GET /api/users/:username/rank", () => {
  it("reports global rank per metric", async () => {
    const res = await request(app).get("/api/users/edcoan/rank");
    expect(res.status).toBe(200);
    expect(res.body.data.ranks.dots.rank).toBe(1);
    expect(res.body.data.ranks.dots.out_of).toBe(5);
  });
});

describe("GET /api/users/:username/personal-bests", () => {
  it("groups PBs by equipment", async () => {
    const res = await request(app).get("/api/users/edcoan/personal-bests?units=kg");
    expect(res.status).toBe(200);
    const raw = res.body.data.by_equipment.find(
      (g: { equipment: string }) => g.equipment === "Raw",
    );
    expect(raw).not.toBeUndefined();
    expect(raw.personal_best.squat).toBe(410);
  });
});

describe("GET /api/users/:username/progression", () => {
  it("emits chronological entries with running PB", async () => {
    const res = await request(app).get("/api/users/edcoan/progression?units=kg");
    expect(res.status).toBe(200);
    expect(res.body.data.progression).toHaveLength(2);
    // Older meet first (2024-05-12), then newer (2024-09-01).
    expect(res.body.data.progression[0].date).toBe("2024-05-12");
    expect(res.body.data.progression[0].running_pb.squat).toBe(410);
  });
});

describe("GET /api/users/compare", () => {
  it("compares two athletes side-by-side", async () => {
    const res = await request(app).get("/api/users/compare?a=edcoan&b=johnsmith1&units=kg");
    expect(res.status).toBe(200);
    expect(res.body.data.a.username).toBe("edcoan");
    expect(res.body.data.b.username).toBe("johnsmith1");
    expect(res.body.data.deltas.total).toBe(110); // 1080 - 970
  });
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

describe("GET /api/records", () => {
  it("returns top-3 records grouped by category and sex+equipment_group", async () => {
    const res = await request(app).get("/api/records");
    expect(res.status).toBe(200);
    const categories = res.body.data.categories.map((c: { key: string }) => c.key);
    expect(categories).toContain("squat_full_power");
    expect(categories).toContain("total");
  });

  it("filters via /:equipment/:sex_or_weight_class (sex)", async () => {
    const res = await request(app).get("/api/records/raw/women");
    expect(res.status).toBe(200);
    const totalCat = res.body.data.categories.find((c: { key: string }) => c.key === "total");
    const sections = totalCat.sections;
    // Only the women / raw subsections should appear.
    for (const s of sections) {
      expect(s.sex).toBe("F");
      expect(s.equipment_group).toBe("raw");
    }
  });

  it("supports the all-tested equipment group via /:equipment", async () => {
    const res = await request(app).get("/api/records/all-tested");
    expect(res.status).toBe(200);
    const totalCat = res.body.data.categories.find((c: { key: string }) => c.key === "total");
    // Ruth (60kg, total 530) is in the all-tested bucket.
    const ruthSection = totalCat.sections.find(
      (s: { sex: string; records: { weight_class_kg: number; lift_value: number }[] }) =>
        s.sex === "F" && s.records.some((r) => r.weight_class_kg === 60),
    );
    expect(ruthSection).not.toBeUndefined();
    const ruth = ruthSection.records.find(
      (r: { weight_class_kg: number }) => r.weight_class_kg === 60,
    );
    expect(ruth.lift_value).toBe(530);
  });
});
