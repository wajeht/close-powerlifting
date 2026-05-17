import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { AppData, Entry } from "../../../data/types";

export function createMeetsRouter(context: AppContext) {
  const router = express.Router();

  router.get("/api/meets", (req: Request, res: Response) => {
    const data = context.store.get();
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const federation =
      typeof req.query.federation === "string" ? req.query.federation.toLowerCase() : null;

    // Build the candidate set lazily so we don't sort 62k rows every request
    // when a small filter exists.
    let candidates: number[];
    if (federation != null) {
      candidates = data.meetsByFederation.get(federation) ?? [];
    } else {
      candidates = Array.from({ length: data.meets.length }, (_, i) => i);
    }

    const sorted = candidates
      .slice()
      .sort((a, b) => data.meets[b]!.date.localeCompare(data.meets[a]!.date));
    const page = sorted.slice(offset, offset + limit);

    res.json({
      status: "success",
      data: {
        total: sorted.length,
        limit,
        offset,
        meets: page.map((id) => meetSummary(data, id)),
      },
    });
  });

  // Express 5 / path-to-regexp v8: catch-all uses `*name`, and the matched
  // segments come back as a string[]. We join them back into the slash-
  // separated meet path that the loader stored.
  router.get("/api/meets/*meetPath", (req: Request, res: Response) => {
    const data = context.store.get();
    const raw = req.params.meetPath;
    const path = Array.isArray(raw) ? raw.join("/") : String(raw ?? "");
    const meetId = data.meetByPath.get(path);
    if (meetId == null) {
      throw new NotFoundError(`Meet "${path}" not found`);
    }
    const meet = data.meets[meetId]!;
    const entryIds = data.entriesByMeet.get(meetId) ?? [];

    const results = entryIds
      .map((id) => data.entries[id]!)
      .sort(byPlaceThenTotal)
      .map((e) => formatMeetEntry(data, e));

    res.json({
      status: "success",
      data: {
        path: meet.path,
        meet_name: meet.meetName,
        federation: meet.federation,
        parent_federation: meet.parentFederation,
        date: meet.date,
        country: meet.meetCountry,
        state: meet.meetState,
        town: meet.meetTown,
        sanctioned: meet.sanctioned,
        results,
      },
    });
  });

  return router;
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== "string") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function meetSummary(data: AppData, meetId: number) {
  const m = data.meets[meetId]!;
  return {
    path: m.path,
    meet_name: m.meetName,
    federation: m.federation,
    date: m.date,
    country: m.meetCountry,
    state: m.meetState,
    town: m.meetTown,
    sanctioned: m.sanctioned,
  };
}

// Order entries within a meet: numerically placed lifters first (by rank
// ascending), then non-placed (DQ / DD / NS / G).
function byPlaceThenTotal(a: Entry, b: Entry): number {
  const ar = a.placeRank;
  const br = b.placeRank;
  if (ar != null && br != null) return ar - br;
  if (ar != null) return -1;
  if (br != null) return 1;
  // Both non-placed: order by total desc as a tie-break.
  return (b.totalKg ?? 0) - (a.totalKg ?? 0);
}

function formatMeetEntry(data: AppData, entry: Entry) {
  const lifter = data.lifters[entry.lifterId]!;
  return {
    username: lifter.username,
    name: lifter.name,
    sex: entry.sex,
    age: entry.age,
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
