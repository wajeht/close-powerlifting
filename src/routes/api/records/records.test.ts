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
    for (const s of totalCat.sections) {
      expect(s.sex).toBe("F");
      expect(s.equipment_group).toBe("raw");
    }
  });

  it("supports the all-tested equipment group via /:equipment", async () => {
    const res = await request(app).get("/api/records/all-tested");
    expect(res.status).toBe(200);
    const totalCat = res.body.data.categories.find((c: { key: string }) => c.key === "total");
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
