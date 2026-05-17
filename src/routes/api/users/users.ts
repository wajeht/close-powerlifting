import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { AppData, Entry } from "../../../data/types";

export function createUsersRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/users
   * @summary Search for lifters by name or username substring
   * @tags Users
   * @param {string} search.query - Case-insensitive substring matched against name + username
   * @param {integer} limit.query - Max matches to return, default 50, max 200
   * @return {object} 200 - Either { total_lifters, message } (no query) or matches[]
   */
  router.get("/api/users", (req: Request, res: Response) => {
    const data = context.store.get();
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length === 0) {
      res.json({
        status: "success",
        data: {
          total_lifters: data.lifters.length,
          message:
            "Pass ?search=<query> to find lifters by name or username, " +
            "or hit /api/users/{username} to load a specific profile.",
        },
      });
      return;
    }

    const limit = clampLimit(req.query.limit, 50);
    const matches = findLifters(data, search, limit);
    res.json({
      status: "success",
      data: matches.map((m) => ({ username: m.username, name: m.name })),
    });
  });

  /**
   * GET /api/users/{username}
   * @summary Lifter profile + chronological competition history
   * @tags Users
   * @param {string} username.path.required - Deterministic ASCII slug (e.g. "edcoan")
   * @return {object} 200 - Profile with personal bests + every entry sorted by date desc
   * @return {object} 404 - No lifter with that username
   */
  router.get("/api/users/:username", (req: Request, res: Response) => {
    const data = context.store.get();
    const rawUsername = String(req.params.username ?? "");
    const username = rawUsername.toLowerCase();
    const lifterId = data.lifterByUsername.get(username);
    if (lifterId == null) {
      throw new NotFoundError(`Lifter "${rawUsername}" not found`);
    }

    const lifter = data.lifters[lifterId]!;
    const entryIds = data.entriesByLifter.get(lifterId) ?? [];
    const entries = entryIds
      .map((id) => data.entries[id]!)
      .sort((a, b) => meetDateOf(data, b.meetId).localeCompare(meetDateOf(data, a.meetId)));

    res.json({
      status: "success",
      data: {
        username: lifter.username,
        name: lifter.name,
        total_entries: entries.length,
        first_meet:
          entries.length > 0 ? meetDateOf(data, entries[entries.length - 1]!.meetId) : null,
        last_meet: entries.length > 0 ? meetDateOf(data, entries[0]!.meetId) : null,
        personal_best: bestPerMetric(entries),
        competition_results: entries.map((e) => formatCompetitionRow(data, e)),
      },
    });
  });

  return router;
}

function clampLimit(raw: unknown, fallback: number): number {
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n, 200);
  }
  return fallback;
}

// Simple search: case-insensitive substring over either `username` or `name`.
// Matches OPL's UX (their search resolves into their username_map). For
// 989k entries this scans ~1M strings — typical 5–30 ms.
function findLifters(
  data: AppData,
  needle: string,
  limit: number,
): { username: string; name: string }[] {
  const q = needle.toLowerCase();
  const matches: { username: string; name: string }[] = [];
  for (const lifter of data.lifters) {
    if (lifter.username.includes(q) || lifter.name.toLowerCase().includes(q)) {
      matches.push({ username: lifter.username, name: lifter.name });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function meetDateOf(data: AppData, meetId: number): string {
  return data.meets[meetId]?.date ?? "";
}

function bestPerMetric(entries: Entry[]): Record<string, number | null> {
  const best = (field: keyof Entry): number | null => {
    let max: number | null = null;
    for (const e of entries) {
      const value = e[field] as number | null;
      if (value == null) continue;
      if (max == null || value > max) max = value;
    }
    return max;
  };
  return {
    squat: best("best3SquatKg"),
    bench: best("best3BenchKg"),
    deadlift: best("best3DeadliftKg"),
    total: best("totalKg"),
    dots: best("dots"),
    wilks: best("wilks"),
  };
}

function formatCompetitionRow(data: AppData, entry: Entry) {
  const meet = data.meets[entry.meetId]!;
  return {
    date: meet.date,
    meet_name: meet.meetName,
    meet_path: meet.path,
    federation: meet.federation,
    event: entry.event,
    equipment: entry.equipment,
    weight_class_kg: entry.weightClassKg,
    bodyweight_kg: entry.bodyweightKg,
    squat: entry.best3SquatKg,
    bench: entry.best3BenchKg,
    deadlift: entry.best3DeadliftKg,
    total: entry.totalKg,
    dots: entry.dots,
    place: entry.placeRank ?? entry.placeStatus,
  };
}
