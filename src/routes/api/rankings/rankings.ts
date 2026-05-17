import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { AppData, Entry, RankMetric } from "../../../data/types";
import { type Units, inUnits, paginate, sendSuccess } from "../api.helpers";
import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.validation";

// ---------- Param → store mappings ----------

const EQUIPMENT_VALUES: Record<string, string[]> = {
  raw: ["Raw"],
  wraps: ["Wraps"],
  "raw-wraps": ["Raw", "Wraps"],
  "single-ply": ["Single-ply"],
  "multi-ply": ["Multi-ply"],
  unlimited: ["Unlimited"],
};

const SEX_VALUES: Record<string, "M" | "F"> = {
  men: "M",
  women: "F",
};

const EVENT_VALUES: Record<string, Entry["event"][]> = {
  "full-power": ["SBD"],
  "push-pull": ["BD", "SB"],
  squat: ["S", "SBD", "SB", "SD"],
  bench: ["B", "SBD", "SB", "BD"],
  deadlift: ["D", "SBD", "SD", "BD"],
};

const SORT_TO_METRIC: Record<string, RankMetric> = {
  "by-dots": "dots",
  "by-wilks": "wilks",
  "by-glossbrenner": "glossbrenner",
  "by-goodlift": "goodlift",
  "by-mcculloch": "dots", // mcculloch not in CSV; fall back to dots
  "by-total": "total",
  "by-squat": "squat",
  "by-bench": "bench",
  "by-deadlift": "deadlift",
};

const METRIC_FIELD: Record<RankMetric, keyof Entry> = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "totalKg",
  squat: "best3SquatKg",
  bench: "best3BenchKg",
  deadlift: "best3DeadliftKg",
};

export function createRankingsRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/rankings
   * @summary Get all rankings with optional pagination
   * @tags Rankings
   */
  router.get("/api/rankings", (req: Request, res: Response) => {
    const data = context.store.get();
    const query = getRankingsValidation.parse(req.query);
    const units: Units = query.units ?? "lbs";
    const federation = query.federation?.toLowerCase() ?? null;

    if (federation == null) {
      // Hot path: use precomputed global rankByMetric.dots.
      const ranking = data.rankByMetric.dots;
      const { pagination } = paginate(
        Array.from({ length: ranking.length }, () => 0),
        query.current_page,
        query.per_page,
      );
      const start = (pagination.current_page - 1) * pagination.per_page;
      const end = Math.min(start + pagination.per_page, ranking.length);
      const rows: unknown[] = [];
      for (let i = start; i < end; i++) {
        rows.push(rankingRow(data, "dots", ranking[i]!, i + 1, units));
      }
      sendSuccess(res, rows, { requestUrl: req.originalUrl, pagination });
      return;
    }

    // Federation filter — narrow first, then sort.
    const ranked = filteredRanking(data, "dots", { federation });
    const { slice, pagination } = paginate(ranked, query.current_page, query.per_page);
    sendSuccess(
      res,
      slice.map((r) => rankingRow(data, "dots", r.lifterId, r.rank, units, r.entryId)),
      { requestUrl: req.originalUrl, pagination },
    );
  });

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}
   * @summary Fully filtered rankings with custom sort
   * @tags Rankings
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
    (req: Request, res: Response) => respondFiltered(context, req, res),
  );

  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event",
    (req: Request, res: Response) => respondFiltered(context, req, res),
  );

  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year",
    (req: Request, res: Response) => respondFiltered(context, req, res),
  );

  router.get("/api/rankings/filter/:equipment/:sex/:weight_class", (req: Request, res: Response) =>
    respondFiltered(context, req, res),
  );

  router.get("/api/rankings/filter/:equipment/:sex", (req: Request, res: Response) =>
    respondFiltered(context, req, res),
  );

  router.get("/api/rankings/filter/:equipment", (req: Request, res: Response) =>
    respondFiltered(context, req, res),
  );

  /**
   * GET /api/rankings/{rank}
   * @summary Get a single ranking by position
   * @tags Rankings
   */
  router.get("/api/rankings/:rank", (req: Request, res: Response) => {
    const data = context.store.get();
    const { rank: rawRank } = getRankValidation.parse(req.params);
    const rank = parseInt(rawRank, 10);
    const ranking = data.rankByMetric.dots;
    if (rank < 1 || rank > ranking.length) {
      throw new NotFoundError(`Rank ${rawRank} is out of range (max=${ranking.length})`);
    }
    sendSuccess(res, rankingRow(data, "dots", ranking[rank - 1]!, rank, "lbs"), {
      requestUrl: req.originalUrl,
    });
  });

  return router;
}

function respondFiltered(context: AppContext, req: Request, res: Response): void {
  const data = context.store.get();
  const params = getFilteredRankingsParamValidation.parse(req.params);
  const query = getFilteredRankingsQueryValidation.parse(req.query);
  const units: Units = query.units ?? "lbs";

  const metric: RankMetric = params.sort != null ? SORT_TO_METRIC[params.sort]! : "dots";

  const filter: RankingFilter = {
    equipmentValues: params.equipment != null ? EQUIPMENT_VALUES[params.equipment] : null,
    sex: params.sex != null ? SEX_VALUES[params.sex] : null,
    weightClassKg: parseWeightClass(params.weight_class),
    yearPrefix: params.year != null ? `${params.year}-` : null,
    eventValues: params.event != null ? EVENT_VALUES[params.event] : null,
    ageClass: query.age_class ?? null,
    federation: query.federation?.toLowerCase() ?? null,
  };

  const ranked = filteredRanking(data, metric, filter);
  const { slice, pagination } = paginate(ranked, query.current_page, query.per_page);
  sendSuccess(
    res,
    slice.map((r) => rankingRow(data, metric, r.lifterId, r.rank, units, r.entryId)),
    { requestUrl: req.originalUrl, pagination },
  );
}

interface RankingFilter {
  equipmentValues?: string[] | null;
  sex?: "M" | "F" | null;
  weightClassKg?: number | null;
  yearPrefix?: string | null;
  eventValues?: Entry["event"][] | null;
  ageClass?: string | null;
  federation?: string | null;
}

// Per-lifter best entry on `metric` that satisfies the filter, then sorted
// DESC by the metric value. Pure linear scan over 3.9M entries; ~30-100ms.
function filteredRanking(
  data: AppData,
  metric: RankMetric,
  filter: RankingFilter,
): { lifterId: number; entryId: number; value: number; rank: number }[] {
  const field = METRIC_FIELD[metric];
  const best = new Map<number, { entryId: number; value: number }>();

  for (let entryId = 0; entryId < data.entries.length; entryId++) {
    const entry = data.entries[entryId]!;
    if (!matchesEntry(data, entry, filter)) continue;
    const value = entry[field] as number | null;
    if (value == null) continue;
    const cur = best.get(entry.lifterId);
    if (cur == null || value > cur.value) {
      best.set(entry.lifterId, { entryId, value });
    }
  }

  const rows = Array.from(best, ([lifterId, b]) => ({ lifterId, ...b }));
  rows.sort((a, b) => b.value - a.value);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function matchesEntry(data: AppData, entry: Entry, filter: RankingFilter): boolean {
  if (filter.equipmentValues != null && !filter.equipmentValues.includes(entry.equipment)) {
    return false;
  }
  if (filter.sex != null && entry.sex !== filter.sex) return false;
  if (filter.weightClassKg != null && entry.weightClassKg !== filter.weightClassKg) return false;
  if (filter.eventValues != null && !filter.eventValues.includes(entry.event)) return false;
  if (filter.ageClass != null && entry.ageClass !== filter.ageClass) return false;
  if (filter.yearPrefix != null || filter.federation != null) {
    const meet = data.meets[entry.meetId]!;
    if (filter.yearPrefix != null && !meet.date.startsWith(filter.yearPrefix)) return false;
    if (filter.federation != null) {
      // Compare against slugified federation.
      const fedSlug = meet.federation.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (fedSlug !== filter.federation) return false;
    }
  }
  return true;
}

function parseWeightClass(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function rankingRow(
  data: AppData,
  metric: RankMetric,
  lifterId: number,
  rank: number,
  units: Units,
  entryIdOverride?: number,
) {
  const entryId =
    entryIdOverride != null ? entryIdOverride : data.bestEntryByLifter[metric][lifterId]!;
  const entry = data.entries[entryId]!;
  const lifter = data.lifters[lifterId]!;
  const meet = data.meets[entry.meetId]!;
  return {
    rank,
    username: lifter.username,
    name: lifter.name,
    sex: entry.sex,
    age: entry.age,
    bodyweight: inUnits(entry.bodyweightKg, units),
    weight_class_kg: entry.weightClassKg,
    equipment: entry.equipment,
    event: entry.event,
    squat: inUnits(entry.best3SquatKg, units),
    bench: inUnits(entry.best3BenchKg, units),
    deadlift: inUnits(entry.best3DeadliftKg, units),
    total: inUnits(entry.totalKg, units),
    dots: entry.dots,
    wilks: entry.wilks,
    glossbrenner: entry.glossbrenner,
    goodlift: entry.goodlift,
    federation: meet.federation,
    meet_path: meet.path,
    meet_name: meet.meetName,
    meet_date: meet.date,
    country: entry.lifterCountry,
    units,
  };
}
