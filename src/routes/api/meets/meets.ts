import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { AppData, Entry, Meet } from "../../../data/types";
import { type Units, inUnits, paginate, sendSuccess } from "../api.helpers";
import {
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.validation";

export function createMeetsRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/meets
   * @summary List meets across federations
   * @tags Meets
   */
  router.get("/api/meets", (req: Request, res: Response) => {
    const data = context.store.get();
    const q = listMeetsQueryValidation.parse(req.query);

    let candidates: Meet[];
    if (q.federation != null) {
      const ids = data.meetsByFederation.get(q.federation.toLowerCase()) ?? [];
      candidates = ids.map((id) => data.meets[id]!);
    } else {
      candidates = data.meets.slice();
    }

    if (q.from != null) candidates = candidates.filter((m) => m.date >= q.from!);
    if (q.to != null) candidates = candidates.filter((m) => m.date <= q.to!);
    if (q.country != null) {
      const needle = q.country.toLowerCase();
      candidates = candidates.filter((m) => (m.meetCountry ?? "").toLowerCase() === needle);
    }
    if (q.state != null) {
      const needle = q.state.toLowerCase();
      candidates = candidates.filter((m) => (m.meetState ?? "").toLowerCase() === needle);
    }
    if (q.search != null) {
      const needle = q.search.toLowerCase();
      candidates = candidates.filter((m) => m.meetName.toLowerCase().includes(needle));
    }

    const direction = q.sort === "date-asc" ? 1 : -1;
    candidates.sort((a, b) => direction * a.date.localeCompare(b.date));

    const { slice, pagination } = paginate(candidates, q.current_page, q.per_page);
    sendSuccess(res, slice.map(meetSummary), { requestUrl: req.originalUrl, pagination });
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}/highlights
   * @summary Get meet highlights — best lift in each category
   * @tags Meets
   */
  router.get("/api/meets/:federation/:date/:slug/highlights", (req: Request, res: Response) => {
    const data = context.store.get();
    const params = getMeetParamValidation.parse(req.params);
    const { units = "lbs" } = getMeetHighlightsQueryValidation.parse(req.query);

    const meetId = lookupMeetId(data, params);
    if (meetId == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    const meet = data.meets[meetId]!;
    const entryIds = data.entriesByMeet.get(meetId) ?? [];
    const entries = entryIds.map((id) => data.entries[id]!);

    sendSuccess(
      res,
      {
        path: meet.path,
        meet_name: meet.meetName,
        federation: meet.federation,
        date: meet.date,
        highlights: {
          best_total: bestByField(data, entries, "totalKg", units),
          best_squat: bestByField(data, entries, "best3SquatKg", units),
          best_bench: bestByField(data, entries, "best3BenchKg", units),
          best_deadlift: bestByField(data, entries, "best3DeadliftKg", units),
          best_dots: bestByField(data, entries, "dots", units),
        },
      },
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}
   * @summary Get meet results
   * @tags Meets
   */
  router.get("/api/meets/:federation/:date/:slug", (req: Request, res: Response) => {
    const data = context.store.get();
    const params = getMeetParamValidation.parse(req.params);
    const { sort = "place", units = "lbs" } = getMeetQueryValidation.parse(req.query);

    const meetId = lookupMeetId(data, params);
    if (meetId == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    const meet = data.meets[meetId]!;
    const entryIds = data.entriesByMeet.get(meetId) ?? [];
    const entries = entryIds.map((id) => data.entries[id]!);

    let sorter: (a: Entry, b: Entry) => number;
    if (sort === "by-total") sorter = (a, b) => (b.totalKg ?? 0) - (a.totalKg ?? 0);
    else if (sort === "by-dots") sorter = (a, b) => (b.dots ?? 0) - (a.dots ?? 0);
    else sorter = byPlaceThenTotal;
    const sorted = entries.slice().sort(sorter);

    sendSuccess(
      res,
      {
        path: meet.path,
        meet_name: meet.meetName,
        federation: meet.federation,
        parent_federation: meet.parentFederation,
        date: meet.date,
        country: meet.meetCountry,
        state: meet.meetState,
        town: meet.meetTown,
        sanctioned: meet.sanctioned,
        results: sorted.map((e) => formatMeetEntry(data, e, units)),
      },
      { requestUrl: req.originalUrl },
    );
  });

  return router;
}

function lookupMeetId(
  data: AppData,
  params: { federation: string; date: string; slug: string },
): number | undefined {
  const fed = params.federation.toLowerCase();
  const slug = params.slug.toLowerCase();
  return data.meetByPath.get(`${fed}/${params.date}/${slug}`);
}

function meetSummary(m: Meet) {
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

function byPlaceThenTotal(a: Entry, b: Entry): number {
  const ar = a.placeRank;
  const br = b.placeRank;
  if (ar != null && br != null) return ar - br;
  if (ar != null) return -1;
  if (br != null) return 1;
  return (b.totalKg ?? 0) - (a.totalKg ?? 0);
}

function formatMeetEntry(data: AppData, entry: Entry, units: Units) {
  const lifter = data.lifters[entry.lifterId]!;
  return {
    username: lifter.username,
    name: lifter.name,
    sex: entry.sex,
    age: entry.age,
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
}

function bestByField(data: AppData, entries: Entry[], field: keyof Entry, units: Units): unknown {
  let best: Entry | null = null;
  let bestVal = -Infinity;
  for (const e of entries) {
    const v = e[field] as number | null;
    if (v == null) continue;
    if (v > bestVal) {
      bestVal = v;
      best = e;
    }
  }
  if (best == null) return null;
  const lifter = data.lifters[best.lifterId]!;
  return {
    username: lifter.username,
    name: lifter.name,
    equipment: best.equipment,
    weight_class_kg: best.weightClassKg,
    value: field === "dots" ? bestVal : inUnits(bestVal, units),
  };
}
