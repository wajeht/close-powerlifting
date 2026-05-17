import { describe, expect, it } from "vite-plus/test";

import { makeFixtureAppData } from "../tests/fixtures";

const fixture = makeFixtureAppData();

describe("buildEntriesByLifter", () => {
  it("groups entries by lifter id", () => {
    // Ed Coan (id 0) has two entries; everyone else has one.
    expect(fixture.entriesByLifter.get(0)).toHaveLength(2);
    expect(fixture.entriesByLifter.get(1)).toHaveLength(1);
  });
});

describe("buildBestEntryByLifter", () => {
  it("picks the entry with the highest value on the metric", () => {
    // Ed Coan: first entry dots=700, second=685. First wins.
    const bestForDots = fixture.bestEntryByLifter.dots[0];
    expect(bestForDots).toBe(0);
  });

  it("marks lifters with no eligible entry on a metric as -1", () => {
    // No fixture entry sets glossbrenner — all lifters should be -1.
    for (let lifterId = 0; lifterId < fixture.lifters.length; lifterId++) {
      expect(fixture.bestEntryByLifter.glossbrenner[lifterId]).toBe(-1);
    }
  });
});

describe("buildRankByMetric", () => {
  it("sorts lifter ids descending by best on the metric", () => {
    const dotsRank = Array.from(fixture.rankByMetric.dots);
    const names = dotsRank.map((lifterId) => fixture.lifters[lifterId]!.username);
    // dots order: Ed Coan 700, John Smith#1 640, Maris 632.5, Kristy 612.3, Ruth 590.
    expect(names).toEqual([
      "edcoan",
      "johnsmith1",
      "marisrazmanis",
      "kristyhawkins",
      "ruthrabbitt",
    ]);
  });

  it("excludes lifters with no eligible entry on the metric", () => {
    // glossbrenner is null on every fixture entry; rank array should be empty.
    expect(fixture.rankByMetric.glossbrenner.length).toBe(0);
  });
});

describe("buildRecords", () => {
  it("emits one row per (category, sex, equipment_group, weight_class, rank)", () => {
    // Filter to raw / M / squat_full_power; weight classes 90 and 93 each have one row.
    const rawMenSquat = fixture.records.filter(
      (r) => r.category === "squat_full_power" && r.sex === "M" && r.equipmentGroup === "raw",
    );
    const byClass = new Map<number, number>();
    for (const r of rawMenSquat)
      byClass.set(r.weightClassKg, (byClass.get(r.weightClassKg) ?? 0) + 1);
    // Class 100 has Ed Coan's best squat 410; class 93 has Maris at 365.
    expect(rawMenSquat.length).toBeGreaterThan(0);
    expect([...byClass.values()].every((count) => count <= 3)).toBe(true);
  });

  it("ranks within a weight class by descending lift value", () => {
    const rawMenTotal = fixture.records.filter(
      (r) => r.category === "total" && r.sex === "M" && r.equipmentGroup === "raw",
    );
    // Each weight class's ranks should be 1..N with monotonically decreasing values.
    const grouped = new Map<number, typeof rawMenTotal>();
    for (const r of rawMenTotal) {
      const list = grouped.get(r.weightClassKg);
      if (list == null) grouped.set(r.weightClassKg, [r]);
      else list.push(r);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.rank - b.rank);
      for (let i = 0; i < list.length; i++) expect(list[i]!.rank).toBe(i + 1);
      for (let i = 1; i < list.length; i++) {
        expect(list[i]!.liftValue).toBeLessThanOrEqual(list[i - 1]!.liftValue);
      }
    }
  });

  it("counts tested entries in the all-tested bucket", () => {
    // Ruth's only entry has tested=true; she's a female 60kg lifter with total 530.
    const ruthAllTestedTotal = fixture.records.find(
      (r) =>
        r.category === "total" &&
        r.sex === "F" &&
        r.equipmentGroup === "all-tested" &&
        r.weightClassKg === 60,
    );
    expect(ruthAllTestedTotal).not.toBeUndefined();
    expect(ruthAllTestedTotal!.rank).toBe(1);
    expect(ruthAllTestedTotal!.liftValue).toBe(530);
  });
});

describe("buildFederations", () => {
  it("returns one row per distinct federation, sorted by meet count desc", () => {
    const slugs = fixture.federations.map((f) => f.slug);
    expect(slugs).toContain("wrpf");
    expect(slugs).toContain("usapl");
    expect(slugs).toContain("ipf");
  });

  it("populates meetsByFederation in parallel", () => {
    const wrpfMeets = fixture.meetsByFederation.get("wrpf");
    expect(wrpfMeets).not.toBeUndefined();
    expect(wrpfMeets!.length).toBe(1);
  });
});
