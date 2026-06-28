import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import type { Entry, RankMetric } from "../../../data/types";
import { type Pagination, type Units, buildPagination, inUnits } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type { GetCompareType, GetUserQueryType, GetUsersType } from "./users.schema";

const { defaultPerPage } = configuration.pagination;

const RANK_METRICS: RankMetric[] = [
  "dots",
  "wilks",
  "glossbrenner",
  "goodlift",
  "total",
  "squat",
  "bench",
  "deadlift",
];

interface LifterRow {
  id: number;
  username: string;
  name: string;
}

interface EntryWithMeetRow {
  id: number;
  lifter_id: number;
  meet_id: number;
  sex: Entry["sex"];
  age: number | null;
  age_class: string | null;
  division: string | null;
  lifter_country: string | null;
  lifter_state: string | null;
  event: Entry["event"];
  equipment: Entry["equipment"];
  tested: number;
  bodyweight_kg: number | null;
  weight_class_kg: number | null;
  squat1_kg: number | null;
  squat2_kg: number | null;
  squat3_kg: number | null;
  squat4_kg: number | null;
  bench1_kg: number | null;
  bench2_kg: number | null;
  bench3_kg: number | null;
  bench4_kg: number | null;
  deadlift1_kg: number | null;
  deadlift2_kg: number | null;
  deadlift3_kg: number | null;
  deadlift4_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  place_rank: number | null;
  place_status: string | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  meet_path: string;
  meet_name: string;
  federation: string;
  meet_date: string;
}

interface RankRow {
  metric: RankMetric;
  rank: number;
}

interface RankCountRow {
  metric: RankMetric;
  count: string | number;
}

export function createUsersService(store: DataStoreType) {
  async function listLifters(query: GetUsersType): Promise<{
    data: { username: string; name: string }[];
    pagination: Pagination;
  }> {
    const { db } = store.get();
    const needle = query.search?.trim() ?? "";
    const base = db<LifterRow>("lifters");
    applyLifterSearch(base, needle);

    const totalRow = await base.clone().count({ count: "*" }).first();
    const total = Number(totalRow?.count ?? 0);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const rows = await base
      .clone()
      .select("username", "name")
      .orderBy("name", "asc")
      .limit(pagination.per_page)
      .offset(pagination.from > 0 ? pagination.from - 1 : 0);

    return {
      data: rows.map((row) => ({ username: row.username, name: row.name })),
      pagination,
    };
  }

  async function getUser(
    username: string,
    query: GetUserQueryType,
  ): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const lifter = await getLifterByUsername(db, username);
    if (lifter == null) return null;
    const units: Units = query.units ?? "lbs";
    const includeAttempts = (query.include_attempts ?? "false") === "true";
    const entries = await lifterEntriesByDate(db, lifter.id, "desc");
    return {
      ...profileSummary(lifter, entries, units),
      competition_results: entries.map((entry) =>
        formatCompetitionRow(entry, units, includeAttempts),
      ),
    };
  }

  async function getProgression(
    username: string,
    units: Units,
  ): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const lifter = await getLifterByUsername(db, username);
    if (lifter == null) return null;

    const entries = await lifterEntriesByDate(db, lifter.id, "asc");
    let runningSquat = -Infinity;
    let runningBench = -Infinity;
    let runningDeadlift = -Infinity;
    let runningTotal = -Infinity;
    let runningDots = -Infinity;
    const out: unknown[] = [];
    for (const entry of entries) {
      if ((entry.best3_squat_kg ?? -Infinity) > runningSquat)
        runningSquat = entry.best3_squat_kg ?? runningSquat;
      if ((entry.best3_bench_kg ?? -Infinity) > runningBench)
        runningBench = entry.best3_bench_kg ?? runningBench;
      if ((entry.best3_deadlift_kg ?? -Infinity) > runningDeadlift)
        runningDeadlift = entry.best3_deadlift_kg ?? runningDeadlift;
      if ((entry.total_kg ?? -Infinity) > runningTotal)
        runningTotal = entry.total_kg ?? runningTotal;
      if ((entry.dots ?? -Infinity) > runningDots) runningDots = entry.dots ?? runningDots;
      out.push({
        date: entry.meet_date,
        meet_name: entry.meet_name,
        meet_path: entry.meet_path,
        federation: entry.federation,
        event: entry.event,
        equipment: entry.equipment,
        weight_class_kg: entry.weight_class_kg,
        bodyweight: inUnits(entry.bodyweight_kg, units),
        squat: inUnits(entry.best3_squat_kg, units),
        bench: inUnits(entry.best3_bench_kg, units),
        deadlift: inUnits(entry.best3_deadlift_kg, units),
        total: inUnits(entry.total_kg, units),
        dots: entry.dots,
        place: entry.place_rank ?? entry.place_status,
        running_pb: {
          squat: inUnits(Number.isFinite(runningSquat) ? runningSquat : null, units),
          bench: inUnits(Number.isFinite(runningBench) ? runningBench : null, units),
          deadlift: inUnits(Number.isFinite(runningDeadlift) ? runningDeadlift : null, units),
          total: inUnits(Number.isFinite(runningTotal) ? runningTotal : null, units),
          dots: Number.isFinite(runningDots) ? runningDots : null,
        },
        units,
      });
    }
    return {
      username: lifter.username,
      name: lifter.name,
      meets: entries.length,
      progression: out,
    };
  }

  async function getPersonalBests(
    username: string,
    units: Units,
  ): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const lifter = await getLifterByUsername(db, username);
    if (lifter == null) return null;
    const entries = await lifterEntriesByDate(db, lifter.id, "desc");
    const byEquipment = new Map<string, EntryWithMeetRow[]>();
    for (const entry of entries) {
      const list = byEquipment.get(entry.equipment);
      if (list == null) byEquipment.set(entry.equipment, [entry]);
      else list.push(entry);
    }
    const groups = Array.from(byEquipment, ([equipment, list]) => ({
      equipment,
      meets: list.length,
      personal_best: bestPerMetric(list, units),
    }));
    return {
      username: lifter.username,
      name: lifter.name,
      total_meets: entries.length,
      by_equipment: groups,
    };
  }

  async function getRank(username: string): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const lifter = await getLifterByUsername(db, username);
    if (lifter == null) return null;

    const rankRows = await db<RankRow>("lifter_bests")
      .where("lifter_id", lifter.id)
      .select("metric", "rank");
    const countRows = await db<RankCountRow>("lifter_bests")
      .select("metric")
      .count({ count: "*" })
      .groupBy("metric");

    const rankByMetric = new Map(rankRows.map((row) => [row.metric, row.rank]));
    const outOfByMetric = new Map(
      countRows.map((row) => [row.metric as RankMetric, Number(row.count)]),
    );
    const ranks: Record<string, { rank: number; out_of: number } | null> = {};
    for (const metric of RANK_METRICS) {
      const rank = rankByMetric.get(metric);
      const outOf = outOfByMetric.get(metric);
      ranks[metric] = rank == null || outOf == null ? null : { rank, out_of: outOf };
    }

    return { username: lifter.username, name: lifter.name, ranks };
  }

  async function compare(
    query: GetCompareType,
  ): Promise<{ found: true; data: unknown } | { found: false; missing: "a" | "b" }> {
    const { db } = store.get();
    const a = await getLifterByUsername(db, query.a);
    const b = await getLifterByUsername(db, query.b);
    if (a == null) return { found: false, missing: "a" };
    if (b == null) return { found: false, missing: "b" };
    const units: Units = query.units ?? "lbs";
    const aEntries = await lifterEntriesByDate(db, a.id, "desc");
    const bEntries = await lifterEntriesByDate(db, b.id, "desc");
    const aProfile = profileSummary(a, aEntries, units);
    const bProfile = profileSummary(b, bEntries, units);
    return {
      found: true,
      data: {
        a: aProfile,
        b: bProfile,
        deltas: {
          squat: numericDelta(aProfile.personal_best.squat, bProfile.personal_best.squat),
          bench: numericDelta(aProfile.personal_best.bench, bProfile.personal_best.bench),
          deadlift: numericDelta(aProfile.personal_best.deadlift, bProfile.personal_best.deadlift),
          total: numericDelta(aProfile.personal_best.total, bProfile.personal_best.total),
          dots: numericDelta(aProfile.personal_best.dots, bProfile.personal_best.dots),
        },
      },
    };
  }

  return {
    listLifters,
    getUser,
    getProgression,
    getPersonalBests,
    getRank,
    compare,
  };
}

function applyLifterSearch(query: Knex.QueryBuilder<LifterRow>, needle: string): void {
  if (needle.length === 0) return;
  const pattern = `%${needle}%`;
  query.where(function applySearch() {
    this.where("username", "like", pattern).orWhere("name", "like", pattern);
  });
}

async function getLifterByUsername(db: Knex, username: string): Promise<LifterRow | null> {
  const row = await db<LifterRow>("lifters")
    .where("username", username.toLowerCase())
    .select("id", "username", "name")
    .first();
  return row ?? null;
}

async function lifterEntriesByDate(
  db: Knex,
  lifterId: number,
  dir: "asc" | "desc",
): Promise<EntryWithMeetRow[]> {
  return db("entries as e")
    .join("meets as m", "m.id", "e.meet_id")
    .where("e.lifter_id", lifterId)
    .orderBy("m.date", dir)
    .select({
      id: "e.id",
      lifter_id: "e.lifter_id",
      meet_id: "e.meet_id",
      sex: "e.sex",
      age: "e.age",
      age_class: "e.age_class",
      division: "e.division",
      lifter_country: "e.lifter_country",
      lifter_state: "e.lifter_state",
      event: "e.event",
      equipment: "e.equipment",
      tested: "e.tested",
      bodyweight_kg: "e.bodyweight_kg",
      weight_class_kg: "e.weight_class_kg",
      squat1_kg: "e.squat1_kg",
      squat2_kg: "e.squat2_kg",
      squat3_kg: "e.squat3_kg",
      squat4_kg: "e.squat4_kg",
      bench1_kg: "e.bench1_kg",
      bench2_kg: "e.bench2_kg",
      bench3_kg: "e.bench3_kg",
      bench4_kg: "e.bench4_kg",
      deadlift1_kg: "e.deadlift1_kg",
      deadlift2_kg: "e.deadlift2_kg",
      deadlift3_kg: "e.deadlift3_kg",
      deadlift4_kg: "e.deadlift4_kg",
      best3_squat_kg: "e.best3_squat_kg",
      best3_bench_kg: "e.best3_bench_kg",
      best3_deadlift_kg: "e.best3_deadlift_kg",
      total_kg: "e.total_kg",
      place_rank: "e.place_rank",
      place_status: "e.place_status",
      dots: "e.dots",
      wilks: "e.wilks",
      glossbrenner: "e.glossbrenner",
      goodlift: "e.goodlift",
      meet_path: "m.path",
      meet_name: "m.meet_name",
      federation: "m.federation",
      meet_date: "m.date",
    });
}

interface PersonalBest {
  squat: number | null;
  bench: number | null;
  deadlift: number | null;
  total: number | null;
  dots: number | null;
  wilks: number | null;
  units: Units;
}

function bestPerMetric(entries: EntryWithMeetRow[], units: Units): PersonalBest {
  function bestKg(field: keyof EntryWithMeetRow): number | null {
    let max: number | null = null;
    for (const entry of entries) {
      const value = entry[field] as number | null;
      if (value == null) continue;
      if (max == null || value > max) max = value;
    }
    return max;
  }
  return {
    squat: inUnits(bestKg("best3_squat_kg"), units),
    bench: inUnits(bestKg("best3_bench_kg"), units),
    deadlift: inUnits(bestKg("best3_deadlift_kg"), units),
    total: inUnits(bestKg("total_kg"), units),
    dots: bestKg("dots"),
    wilks: bestKg("wilks"),
    units,
  };
}

function profileSummary(lifter: LifterRow, entries: EntryWithMeetRow[], units: Units) {
  return {
    username: lifter.username,
    name: lifter.name,
    total_entries: entries.length,
    first_meet: entries.length > 0 ? entries[entries.length - 1]!.meet_date : null,
    last_meet: entries.length > 0 ? entries[0]!.meet_date : null,
    personal_best: bestPerMetric(entries, units),
  };
}

function numericDelta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((a - b) * 100) / 100;
}

function formatCompetitionRow(entry: EntryWithMeetRow, units: Units, includeAttempts: boolean) {
  const base: Record<string, unknown> = {
    date: entry.meet_date,
    meet_name: entry.meet_name,
    meet_path: entry.meet_path,
    federation: entry.federation,
    event: entry.event,
    equipment: entry.equipment,
    weight_class_kg: entry.weight_class_kg,
    bodyweight: inUnits(entry.bodyweight_kg, units),
    squat: inUnits(entry.best3_squat_kg, units),
    bench: inUnits(entry.best3_bench_kg, units),
    deadlift: inUnits(entry.best3_deadlift_kg, units),
    total: inUnits(entry.total_kg, units),
    dots: entry.dots,
    place: entry.place_rank ?? entry.place_status,
    units,
  };
  if (includeAttempts) {
    base.attempts = {
      squat: [
        inUnits(entry.squat1_kg, units),
        inUnits(entry.squat2_kg, units),
        inUnits(entry.squat3_kg, units),
        inUnits(entry.squat4_kg, units),
      ],
      bench: [
        inUnits(entry.bench1_kg, units),
        inUnits(entry.bench2_kg, units),
        inUnits(entry.bench3_kg, units),
        inUnits(entry.bench4_kg, units),
      ],
      deadlift: [
        inUnits(entry.deadlift1_kg, units),
        inUnits(entry.deadlift2_kg, units),
        inUnits(entry.deadlift3_kg, units),
        inUnits(entry.deadlift4_kg, units),
      ],
    };
  }
  return base;
}
