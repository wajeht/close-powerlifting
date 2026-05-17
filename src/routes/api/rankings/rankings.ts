import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import type { AppData, Entry, RankMetric } from "../../../data/types";

// Map the `?metric=` query param values to the AppData.rankByMetric keys.
const METRIC_BY_QUERY: Record<string, RankMetric> = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "total",
  squat: "squat",
  bench: "bench",
  deadlift: "deadlift",
};

export function createRankingsRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/rankings
   * @summary Top lifters by metric, deduplicated to each lifter's best entry
   * @tags Rankings
   * @param {string} metric.query - Sort key. One of: dots (default), wilks, glossbrenner, goodlift, total, squat, bench, deadlift
   * @param {integer} limit.query - Page size, default 50, max 500
   * @param {integer} offset.query - Page offset, default 0
   * @return {object} 200 - { metric, total, limit, offset, rankings[] }
   * @return {object} 503 - Data is still warming up
   */
  router.get("/api/rankings", (req: Request, res: Response) => {
    const data = context.store.get();
    const metric = parseMetric(req.query.metric);
    const limit = clampInt(req.query.limit, 50, 1, 500);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    const ranking = data.rankByMetric[metric];
    const sliced = ranking.subarray(offset, offset + limit);

    res.json({
      status: "success",
      data: {
        metric,
        total: ranking.length,
        limit,
        offset,
        rankings: Array.from(sliced, (lifterId, idx) =>
          rankingRow(data, metric, lifterId, offset + idx + 1),
        ),
      },
    });
  });

  /**
   * GET /api/rankings/{rank}
   * @summary Lifter at a specific rank on a metric
   * @tags Rankings
   * @param {integer} rank.path.required - 1-based rank position
   * @param {string} metric.query - Sort key (see /api/rankings)
   * @return {object} 200 - The ranking row at that position
   * @return {object} 404 - Rank out of range for the chosen metric
   */
  router.get("/api/rankings/:rank", (req: Request, res: Response) => {
    const data = context.store.get();
    const metric = parseMetric(req.query.metric);
    const rawRank = String(req.params.rank ?? "");
    const rank = parseInt(rawRank, 10);
    const ranking = data.rankByMetric[metric];
    if (!/^\d+$/.test(rawRank) || !Number.isFinite(rank) || rank < 1 || rank > ranking.length) {
      res.status(404).json({
        status: "fail",
        message: `Rank ${rawRank} is out of range for metric=${metric} (max=${ranking.length})`,
        data: null,
      });
      return;
    }
    const lifterId = ranking[rank - 1]!;
    res.json({
      status: "success",
      data: rankingRow(data, metric, lifterId, rank),
    });
  });

  return router;
}

function parseMetric(raw: unknown): RankMetric {
  if (typeof raw === "string" && METRIC_BY_QUERY[raw] != null) {
    return METRIC_BY_QUERY[raw];
  }
  return "dots";
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== "string") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Builds the response row for a single rank position. Looks up the lifter's
// best-on-this-metric entry through the precomputed indexes — no scans.
function rankingRow(data: AppData, metric: RankMetric, lifterId: number, rank: number) {
  const entryId = data.bestEntryByLifter[metric][lifterId]!;
  const entry = data.entries[entryId]!;
  return formatRanking(data, lifterId, entry, rank);
}

function formatRanking(data: AppData, lifterId: number, entry: Entry, rank: number) {
  const lifter = data.lifters[lifterId]!;
  const meet = data.meets[entry.meetId]!;
  return {
    rank,
    username: lifter.username,
    name: lifter.name,
    sex: entry.sex,
    age: entry.age,
    bodyweight_kg: entry.bodyweightKg,
    weight_class_kg: entry.weightClassKg,
    equipment: entry.equipment,
    event: entry.event,
    squat: entry.best3SquatKg,
    bench: entry.best3BenchKg,
    deadlift: entry.best3DeadliftKg,
    total: entry.totalKg,
    dots: entry.dots,
    wilks: entry.wilks,
    glossbrenner: entry.glossbrenner,
    goodlift: entry.goodlift,
    federation: meet.federation,
    meet_path: meet.path,
    meet_name: meet.meetName,
    meet_date: meet.date,
  };
}
