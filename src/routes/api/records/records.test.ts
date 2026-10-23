import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";
import { RecordsData } from "./records.schema";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/records", () => {
  it("keeps shared fixture records separate for 84 and 84+ classes", async () => {
    for (const weightClass of ["84", "84%2B"]) {
      const response = await app.request(`/api/records/raw/${weightClass}`);
      expect(response.status).toBe(200);
      const data = RecordsData.parse((await response.json()).data);
      const total = data.categories.find((category) => category.key === "total");
      expect(total?.sections[0]?.records).toMatchObject([
        {
          weight_class_kg: 84,
          weight_class_over: weightClass === "84%2B",
          rank: 1,
          lift_value: weightClass === "84%2B" ? 530 : 500,
        },
      ]);
    }
  });

  it("excludes the shared fixture athlete's failed lifts from records", async () => {
    const profileResponse = await app.request("/api/users/failedlifter?units=kg");
    expect(profileResponse.status).toBe(200);
    expect((await profileResponse.json()).data.competition_results).toMatchObject([
      { weight_class_kg: 70, squat: -100, bench: -60, deadlift: -120, place: "DQ" },
    ]);
    const response = await app.request("/api/records/raw/70");
    expect(response.status).toBe(200);
    const data = RecordsData.parse((await response.json()).data);
    for (const category of data.categories) expect(category.sections).toEqual([]);
  });

  it("returns top-3 records grouped by category and sex+equipment_group", async () => {
    const res = await app.request("/api/records");
    expect(res.status).toBe(200);
    const body = await res.json();
    const categories = body.data.categories.map((c: { key: string }) => c.key);
    expect(categories).toContain("squat_full_power");
    expect(categories).toContain("total");
  });

  it("filters via /:equipment/:sex_or_weight_class (sex)", async () => {
    const res = await app.request("/api/records/raw/women");
    expect(res.status).toBe(200);
    const body = await res.json();
    const totalCat = body.data.categories.find((c: { key: string }) => c.key === "total");
    for (const s of totalCat.sections) {
      expect(s.sex).toBe("F");
      expect(s.equipment_group).toBe("raw");
    }
  });

  it("supports the all-tested equipment group via /:equipment", async () => {
    const res = await app.request("/api/records/all-tested");
    expect(res.status).toBe(200);
    const body = await res.json();
    const totalCat = body.data.categories.find((c: { key: string }) => c.key === "total");
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
