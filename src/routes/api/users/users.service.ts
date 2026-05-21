import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DataStoreType } from "../../../data/store";
import type { RankMetric } from "../../../data/types";
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

interface EntryMeetRow {
  id: number;
  lifter_id: number;
  meet_id: number;
  sex: string | null;
  age: number | null;
  age_class: string | null;
  event: string;
  equipment: string;
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
  meet_date: string;
  meet_name: string;
  meet_path: string;
  federation: string;
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

export function createUsersService(store: DataStoreType) {
  function listLifters(query: GetUsersType): {
    data: { username: string; name: string }[];
    pagination: Pagination;
  } {
    const db = store.get();
    const needle = query.search?.trim().toLowerCase() ?? "";
    const hasSearch = needle.length > 0;
    const where = hasSearch ? "WHERE username LIKE ? OR lower(name) LIKE ?" : "";
    const countParams: SQLInputValue[] = hasSearch ? [`%${needle}%`, `%${needle}%`] : [];
    const total = scalarCount(db, `SELECT COUNT(*) AS count FROM lifters ${where}`, countParams);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const rows = db
      .prepare(`SELECT username, name FROM lifters ${where} ORDER BY id LIMIT ? OFFSET ?`)
      .all(...countParams, pagination.per_page, offset(pagination)) as unknown as {
      username: string;
      name: string;
    }[];
    return { data: rows, pagination };
  }

  function getUser(username: string, query: GetUserQueryType): Record<string, unknown> | null {
    const db = store.get();
    const lifter = lookupLifter(db, username);
    if (lifter == null) return null;
    const units: Units = query.units ?? "lbs";
    const includeAttempts = (query.include_attempts ?? "false") === "true";
    const profile = profileSummary(db, lifter, units);
    const entries = lifterEntriesByDate(db, lifter.id, "desc");
    return {
      ...profile,
      competition_results: entries.map((entry) =>
        formatCompetitionRow(entry, units, includeAttempts),
      ),
    };
  }

  function getProgression(username: string, units: Units): Record<string, unknown> | null {
    const db = store.get();
    const lifter = lookupLifter(db, username);
    if (lifter == null) return null;

    const entries = lifterEntriesByDate(db, lifter.id, "asc");
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

  function getPersonalBests(username: string, units: Units): Record<string, unknown> | null {
    const db = store.get();
    const lifter = lookupLifter(db, username);
    if (lifter == null) return null;
    const entries = lifterEntriesByDate(db, lifter.id, "desc");
    const byEquipment = new Map<string, EntryMeetRow[]>();
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

  function getRank(username: string): Record<string, unknown> | null {
    const db = store.get();
    const lifter = lookupLifter(db, username);
    if (lifter == null) return null;
    const ranks: Record<string, { rank: number; out_of: number } | null> = {};
    for (const metric of RANK_METRICS) {
      const row = db
        .prepare("SELECT rank FROM rankings WHERE metric = ? AND lifter_id = ?")
        .get(metric, lifter.id) as { rank: number } | undefined;
      const total = scalarCount(db, "SELECT COUNT(*) AS count FROM rankings WHERE metric = ?", [
        metric,
      ]);
      ranks[metric] = row == null ? null : { rank: row.rank, out_of: total };
    }
    return { username: lifter.username, name: lifter.name, ranks };
  }

  function compare(
    query: GetCompareType,
  ): { found: true; data: unknown } | { found: false; missing: "a" | "b" } {
    const db = store.get();
    const a = lookupLifter(db, query.a);
    const b = lookupLifter(db, query.b);
    if (a == null) return { found: false, missing: "a" };
    if (b == null) return { found: false, missing: "b" };
    const units: Units = query.units ?? "lbs";
    const aProfile = profileSummary(db, a, units);
    const bProfile = profileSummary(db, b, units);
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

function lookupLifter(db: DatabaseSync, username: string): LifterRow | null {
  const row = db
    .prepare("SELECT id, username, name FROM lifters WHERE username = ?")
    .get(username.toLowerCase()) as LifterRow | undefined;
  return row ?? null;
}

function lifterEntriesByDate(
  db: DatabaseSync,
  lifterId: number,
  dir: "asc" | "desc",
): EntryMeetRow[] {
  return db
    .prepare(
      `${entrySelectSql()} WHERE e.lifter_id = ? ORDER BY m.date ${dir === "asc" ? "ASC" : "DESC"}`,
    )
    .all(lifterId) as unknown as EntryMeetRow[];
}

function entrySelectSql(): string {
  return `
    SELECT
      e.id,
      e.lifter_id,
      e.meet_id,
      e.sex,
      e.age,
      e.age_class,
      e.event,
      e.equipment,
      e.bodyweight_kg,
      e.weight_class_kg,
      e.squat1_kg,
      e.squat2_kg,
      e.squat3_kg,
      e.squat4_kg,
      e.bench1_kg,
      e.bench2_kg,
      e.bench3_kg,
      e.bench4_kg,
      e.deadlift1_kg,
      e.deadlift2_kg,
      e.deadlift3_kg,
      e.deadlift4_kg,
      e.best3_squat_kg,
      e.best3_bench_kg,
      e.best3_deadlift_kg,
      e.total_kg,
      e.place_rank,
      e.place_status,
      e.dots,
      e.wilks,
      m.date AS meet_date,
      m.meet_name,
      m.path AS meet_path,
      m.federation
    FROM entries e
    JOIN meets m ON m.id = e.meet_id
  `;
}

function bestPerMetric(entries: EntryMeetRow[], units: Units): PersonalBest {
  function best(field: keyof EntryMeetRow): number | null {
    let max: number | null = null;
    for (const entry of entries) {
      const value = entry[field] as number | null;
      if (value == null) continue;
      if (max == null || value > max) max = value;
    }
    return max;
  }
  return {
    squat: inUnits(best("best3_squat_kg"), units),
    bench: inUnits(best("best3_bench_kg"), units),
    deadlift: inUnits(best("best3_deadlift_kg"), units),
    total: inUnits(best("total_kg"), units),
    dots: best("dots"),
    wilks: best("wilks"),
    units,
  };
}

function profileSummary(db: DatabaseSync, lifter: LifterRow, units: Units) {
  const entries = lifterEntriesByDate(db, lifter.id, "desc");
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

function formatCompetitionRow(entry: EntryMeetRow, units: Units, includeAttempts: boolean) {
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

function scalarCount(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): number {
  const row = db.prepare(sql).get(...params) as { count: number } | undefined;
  return row?.count ?? 0;
}

function offset(pagination: Pagination): number {
  return (pagination.current_page - 1) * pagination.per_page;
}
