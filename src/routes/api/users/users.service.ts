import type { DataStoreType } from "../../../data/store";
import type { AppData, Entry, RankMetric } from "../../../data/types";
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

export function createUsersService(store: DataStoreType) {
  function listLifters(query: GetUsersType): {
    data: { username: string; name: string }[];
    pagination: Pagination;
  } {
    const data = store.get();
    const needle = query.search?.trim() ?? "";
    const matches = needle.length === 0 ? data.lifters : findLifters(data, needle);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(matches.length, currentPage, perPage);
    const start = (pagination.current_page - 1) * pagination.per_page;
    const slice = matches
      .slice(start, start + pagination.per_page)
      .map((l) => ({ username: l.username, name: l.name }));
    return { data: slice, pagination };
  }

  function getUser(username: string, query: GetUserQueryType): Record<string, unknown> | null {
    const data = store.get();
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) return null;
    const units: Units = query.units ?? "lbs";
    const includeAttempts = (query.include_attempts ?? "false") === "true";
    const profile = profileSummary(data, lifterId, units);
    const entries = lifterEntriesByDate(data, lifterId, "desc");
    return {
      ...profile,
      competition_results: entries.map((e) =>
        formatCompetitionRow(data, e, units, includeAttempts),
      ),
    };
  }

  function getProgression(username: string, units: Units): Record<string, unknown> | null {
    const data = store.get();
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) return null;

    const entries = lifterEntriesByDate(data, lifterId, "asc");
    let runningSquat = -Infinity;
    let runningBench = -Infinity;
    let runningDeadlift = -Infinity;
    let runningTotal = -Infinity;
    let runningDots = -Infinity;
    const out: unknown[] = [];
    for (const e of entries) {
      const meet = data.meets[e.meetId]!;
      if ((e.best3SquatKg ?? -Infinity) > runningSquat)
        runningSquat = e.best3SquatKg ?? runningSquat;
      if ((e.best3BenchKg ?? -Infinity) > runningBench)
        runningBench = e.best3BenchKg ?? runningBench;
      if ((e.best3DeadliftKg ?? -Infinity) > runningDeadlift)
        runningDeadlift = e.best3DeadliftKg ?? runningDeadlift;
      if ((e.totalKg ?? -Infinity) > runningTotal) runningTotal = e.totalKg ?? runningTotal;
      if ((e.dots ?? -Infinity) > runningDots) runningDots = e.dots ?? runningDots;
      out.push({
        date: meet.date,
        meet_name: meet.meetName,
        meet_path: meet.path,
        federation: meet.federation,
        event: e.event,
        equipment: e.equipment,
        weight_class_kg: e.weightClassKg,
        bodyweight: inUnits(e.bodyweightKg, units),
        squat: inUnits(e.best3SquatKg, units),
        bench: inUnits(e.best3BenchKg, units),
        deadlift: inUnits(e.best3DeadliftKg, units),
        total: inUnits(e.totalKg, units),
        dots: e.dots,
        place: e.placeRank ?? e.placeStatus,
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
    const lifter = data.lifters[lifterId]!;
    return {
      username: lifter.username,
      name: lifter.name,
      meets: entries.length,
      progression: out,
    };
  }

  function getPersonalBests(username: string, units: Units): Record<string, unknown> | null {
    const data = store.get();
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) return null;
    const entryIds = data.entriesByLifter.get(lifterId) ?? [];
    const byEquipment = new Map<string, Entry[]>();
    for (const id of entryIds) {
      const e = data.entries[id]!;
      const list = byEquipment.get(e.equipment);
      if (list == null) byEquipment.set(e.equipment, [e]);
      else list.push(e);
    }
    const groups = Array.from(byEquipment, ([equipment, list]) => ({
      equipment,
      meets: list.length,
      personal_best: bestPerMetric(list, units),
    }));
    const lifter = data.lifters[lifterId]!;
    return {
      username: lifter.username,
      name: lifter.name,
      total_meets: entryIds.length,
      by_equipment: groups,
    };
  }

  function getRank(username: string): Record<string, unknown> | null {
    const data = store.get();
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) return null;
    const ranks: Record<string, { rank: number; out_of: number } | null> = {};
    for (const metric of RANK_METRICS) {
      const list = data.rankByMetric[metric];
      const rank = indexOfTyped(list, lifterId);
      ranks[metric] = rank === -1 ? null : { rank: rank + 1, out_of: list.length };
    }
    const lifter = data.lifters[lifterId]!;
    return { username: lifter.username, name: lifter.name, ranks };
  }

  function compare(
    query: GetCompareType,
  ): { found: true; data: unknown } | { found: false; missing: "a" | "b" } {
    const data = store.get();
    const aId = data.lifterByUsername.get(query.a.toLowerCase());
    const bId = data.lifterByUsername.get(query.b.toLowerCase());
    if (aId == null) return { found: false, missing: "a" };
    if (bId == null) return { found: false, missing: "b" };
    const units: Units = query.units ?? "lbs";
    const aProfile = profileSummary(data, aId, units);
    const bProfile = profileSummary(data, bId, units);
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

function indexOfTyped(arr: Uint32Array, value: number): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === value) return i;
  }
  return -1;
}

function findLifters(data: AppData, needle: string): { username: string; name: string }[] {
  const q = needle.toLowerCase();
  const matches: { username: string; name: string }[] = [];
  for (const lifter of data.lifters) {
    if (lifter.username.includes(q) || lifter.name.toLowerCase().includes(q)) {
      matches.push({ username: lifter.username, name: lifter.name });
    }
  }
  return matches;
}

function lifterEntriesByDate(data: AppData, lifterId: number, dir: "asc" | "desc"): Entry[] {
  const ids = data.entriesByLifter.get(lifterId) ?? [];
  const out = ids.map((id) => data.entries[id]!);
  out.sort((a, b) => {
    const ad = data.meets[a.meetId]!.date;
    const bd = data.meets[b.meetId]!.date;
    return dir === "asc" ? ad.localeCompare(bd) : bd.localeCompare(ad);
  });
  return out;
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

function bestPerMetric(entries: Entry[], units: Units): PersonalBest {
  function bestKg(field: keyof Entry): number | null {
    let max: number | null = null;
    for (const e of entries) {
      const v = e[field] as number | null;
      if (v == null) continue;
      if (max == null || v > max) max = v;
    }
    return max;
  }
  return {
    squat: inUnits(bestKg("best3SquatKg"), units),
    bench: inUnits(bestKg("best3BenchKg"), units),
    deadlift: inUnits(bestKg("best3DeadliftKg"), units),
    total: inUnits(bestKg("totalKg"), units),
    dots: bestKg("dots"),
    wilks: bestKg("wilks"),
    units,
  };
}

function profileSummary(data: AppData, lifterId: number, units: Units) {
  const lifter = data.lifters[lifterId]!;
  const entryIds = data.entriesByLifter.get(lifterId) ?? [];
  const entries = entryIds.map((id) => data.entries[id]!);
  const sortedDesc = entries
    .slice()
    .sort((a, b) => data.meets[b.meetId]!.date.localeCompare(data.meets[a.meetId]!.date));
  return {
    username: lifter.username,
    name: lifter.name,
    total_entries: entries.length,
    first_meet:
      entries.length > 0 ? data.meets[sortedDesc[sortedDesc.length - 1]!.meetId]!.date : null,
    last_meet: entries.length > 0 ? data.meets[sortedDesc[0]!.meetId]!.date : null,
    personal_best: bestPerMetric(entries, units),
  };
}

function numericDelta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((a - b) * 100) / 100;
}

function formatCompetitionRow(data: AppData, entry: Entry, units: Units, includeAttempts: boolean) {
  const meet = data.meets[entry.meetId]!;
  const base: Record<string, unknown> = {
    date: meet.date,
    meet_name: meet.meetName,
    meet_path: meet.path,
    federation: meet.federation,
    event: entry.event,
    equipment: entry.equipment,
    weight_class_kg: entry.weightClassKg,
    bodyweight: inUnits(entry.bodyweightKg, units),
    squat: inUnits(entry.best3SquatKg, units),
    bench: inUnits(entry.best3BenchKg, units),
    deadlift: inUnits(entry.best3DeadliftKg, units),
    total: inUnits(entry.totalKg, units),
    dots: entry.dots,
    place: entry.placeRank ?? entry.placeStatus,
    units,
  };
  if (includeAttempts) {
    base.attempts = {
      squat: [
        inUnits(entry.squat1Kg, units),
        inUnits(entry.squat2Kg, units),
        inUnits(entry.squat3Kg, units),
        inUnits(entry.squat4Kg, units),
      ],
      bench: [
        inUnits(entry.bench1Kg, units),
        inUnits(entry.bench2Kg, units),
        inUnits(entry.bench3Kg, units),
        inUnits(entry.bench4Kg, units),
      ],
      deadlift: [
        inUnits(entry.deadlift1Kg, units),
        inUnits(entry.deadlift2Kg, units),
        inUnits(entry.deadlift3Kg, units),
        inUnits(entry.deadlift4Kg, units),
      ],
    };
  }
  return base;
}
