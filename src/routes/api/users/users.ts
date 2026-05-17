import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { AppData, Entry, RankMetric } from "../../../data/types";
import { type Units, inUnits, paginate, sendSuccess } from "../api.helpers";
import {
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.validation";

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

export function createUsersRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/users
   * @summary Search for athletes or return total count
   * @tags Users
   */
  router.get("/api/users", (req: Request, res: Response) => {
    const data = context.store.get();
    const query = getUsersValidation.parse(req.query);
    const needle = query.search?.trim() ?? "";

    if (needle.length === 0) {
      sendSuccess(
        res,
        {
          total_lifters: data.lifters.length,
          message:
            "Pass ?search=<query> to find lifters by name or username, or hit /api/users/{username} to load a profile.",
        },
        { requestUrl: req.originalUrl },
      );
      return;
    }

    const matches = findLifters(data, needle);
    const { slice, pagination } = paginate(matches, query.current_page, query.per_page);
    sendSuccess(res, slice, { requestUrl: req.originalUrl, pagination });
  });

  /**
   * GET /api/users/compare
   * @summary Compare two athletes side-by-side
   * @tags Users
   */
  router.get("/api/users/compare", (req: Request, res: Response) => {
    const data = context.store.get();
    const { a, b, units = "lbs" } = getCompareValidation.parse(req.query);
    const aId = data.lifterByUsername.get(a.toLowerCase());
    const bId = data.lifterByUsername.get(b.toLowerCase());
    if (aId == null) throw new NotFoundError(`Lifter "${a}" not found`);
    if (bId == null) throw new NotFoundError(`Lifter "${b}" not found`);

    const aProfile = profileSummary(data, aId, units);
    const bProfile = profileSummary(data, bId, units);
    sendSuccess(
      res,
      {
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
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/users/{username}/progression
   * @summary Get competition progression over time
   * @tags Users
   */
  router.get("/api/users/:username/progression", (req: Request, res: Response) => {
    const data = context.store.get();
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) throw new NotFoundError(`Lifter "${username}" not found`);

    const entries = lifterEntriesByDate(data, lifterId, "asc");
    const out: unknown[] = [];
    let runningSquat = -Infinity;
    let runningBench = -Infinity;
    let runningDeadlift = -Infinity;
    let runningTotal = -Infinity;
    let runningDots = -Infinity;
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
    sendSuccess(
      res,
      {
        username: lifter.username,
        name: lifter.name,
        meets: entries.length,
        progression: out,
      },
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/users/{username}/personal-bests
   * @summary Get personal bests grouped by equipment
   * @tags Users
   */
  router.get("/api/users/:username/personal-bests", (req: Request, res: Response) => {
    const data = context.store.get();
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) throw new NotFoundError(`Lifter "${username}" not found`);

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
    sendSuccess(
      res,
      {
        username: lifter.username,
        name: lifter.name,
        total_meets: entryIds.length,
        by_equipment: groups,
      },
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/users/{username}/rank
   * @summary Global rank of this athlete per metric
   * @tags Users
   */
  router.get("/api/users/:username/rank", (req: Request, res: Response) => {
    const data = context.store.get();
    const { username } = getUserParamValidation.parse(req.params);
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) throw new NotFoundError(`Lifter "${username}" not found`);

    const ranks: Record<string, { rank: number; out_of: number } | null> = {};
    for (const metric of RANK_METRICS) {
      const list = data.rankByMetric[metric];
      const rank = indexOfTyped(list, lifterId);
      ranks[metric] = rank === -1 ? null : { rank: rank + 1, out_of: list.length };
    }

    const lifter = data.lifters[lifterId]!;
    sendSuccess(
      res,
      { username: lifter.username, name: lifter.name, ranks },
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/users/{username}
   * @summary Get athlete profile with competition history
   * @tags Users
   */
  router.get("/api/users/:username", (req: Request, res: Response) => {
    const data = context.store.get();
    const { username } = getUserParamValidation.parse(req.params);
    const { include_attempts = "false", units = "lbs" } = getUserQueryValidation.parse(req.query);
    const lifterId = data.lifterByUsername.get(username.toLowerCase());
    if (lifterId == null) throw new NotFoundError(`Lifter "${username}" not found`);

    const profile = profileSummary(data, lifterId, units);
    const entries = lifterEntriesByDate(data, lifterId, "desc");
    sendSuccess(
      res,
      {
        ...profile,
        competition_results: entries.map((e) =>
          formatCompetitionRow(data, e, units, include_attempts === "true"),
        ),
      },
      { requestUrl: req.originalUrl },
    );
  });

  return router;
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

function bestPerMetric(entries: Entry[], units: Units) {
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
