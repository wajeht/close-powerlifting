import type { DataStoreType } from "../../../data/store";
import type { Entry, Meet } from "../../../data/types";
import { type Pagination, type Units, buildPagination, inUnits } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type {
  GetMeetHighlightsQueryType,
  GetMeetParamType,
  GetMeetQueryType,
  ListMeetsQueryType,
} from "./meets.schema";

const { defaultPerPage } = configuration.pagination;

export function createMeetsService(store: DataStoreType) {
  function listMeets(query: ListMeetsQueryType): { data: unknown[]; pagination: Pagination } {
    const data = store.get();
    let candidates: Meet[];
    if (query.federation != null) {
      const ids = data.meetsByFederation.get(query.federation.toLowerCase()) ?? [];
      candidates = ids.map((id) => data.meets[id]!);
    } else {
      candidates = data.meets.slice();
    }

    if (query.from != null) candidates = candidates.filter((m) => m.date >= query.from!);
    if (query.to != null) candidates = candidates.filter((m) => m.date <= query.to!);
    if (query.country != null) {
      const needle = query.country.toLowerCase();
      candidates = candidates.filter((m) => (m.meetCountry ?? "").toLowerCase() === needle);
    }
    if (query.state != null) {
      const needle = query.state.toLowerCase();
      candidates = candidates.filter((m) => (m.meetState ?? "").toLowerCase() === needle);
    }
    if (query.search != null) {
      const needle = query.search.toLowerCase();
      candidates = candidates.filter((m) => m.meetName.toLowerCase().includes(needle));
    }

    const direction = query.sort === "date-asc" ? 1 : -1;
    candidates.sort((a, b) => direction * a.date.localeCompare(b.date));

    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(candidates.length, currentPage, perPage);
    const start = (pagination.current_page - 1) * pagination.per_page;
    const page = candidates.slice(start, start + pagination.per_page);
    return { data: page.map(toMeetSummary), pagination };
  }

  function getMeet(
    params: GetMeetParamType,
    query: GetMeetQueryType,
  ): Record<string, unknown> | null {
    const data = store.get();
    const meetId = lookupMeetId(params);
    if (meetId == null) return null;
    const meet = data.meets[meetId]!;
    const entryIds = data.entriesByMeet.get(meetId) ?? [];
    const entries = entryIds.map((id) => data.entries[id]!);
    const sort = query.sort ?? "place";
    const units: Units = query.units ?? "lbs";

    let sorter: (a: Entry, b: Entry) => number;
    if (sort === "by-total") sorter = (a, b) => (b.totalKg ?? 0) - (a.totalKg ?? 0);
    else if (sort === "by-dots") sorter = (a, b) => (b.dots ?? 0) - (a.dots ?? 0);
    else sorter = byPlaceThenTotal;
    const sorted = entries.slice().sort(sorter);

    return {
      path: meet.path,
      meet_name: meet.meetName,
      federation: meet.federation,
      parent_federation: meet.parentFederation,
      date: meet.date,
      country: meet.meetCountry,
      state: meet.meetState,
      town: meet.meetTown,
      sanctioned: meet.sanctioned,
      results: sorted.map((e) => formatMeetEntry(e, units)),
    };
  }

  function getMeetHighlights(
    params: GetMeetParamType,
    query: GetMeetHighlightsQueryType,
  ): Record<string, unknown> | null {
    const data = store.get();
    const meetId = lookupMeetId(params);
    if (meetId == null) return null;
    const meet = data.meets[meetId]!;
    const entryIds = data.entriesByMeet.get(meetId) ?? [];
    const entries = entryIds.map((id) => data.entries[id]!);
    const units: Units = query.units ?? "lbs";

    return {
      path: meet.path,
      meet_name: meet.meetName,
      federation: meet.federation,
      date: meet.date,
      highlights: {
        best_total: bestByField(entries, "totalKg", units),
        best_squat: bestByField(entries, "best3SquatKg", units),
        best_bench: bestByField(entries, "best3BenchKg", units),
        best_deadlift: bestByField(entries, "best3DeadliftKg", units),
        best_dots: bestByField(entries, "dots", units),
      },
    };
  }

  function lookupMeetId(params: GetMeetParamType): number | undefined {
    const data = store.get();
    return data.meetByPath.get(
      `${params.federation.toLowerCase()}/${params.date}/${params.slug.toLowerCase()}`,
    );
  }

  function toMeetSummary(m: Meet) {
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

  function formatMeetEntry(entry: Entry, units: Units) {
    const data = store.get();
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

  function bestByField(entries: Entry[], field: keyof Entry, units: Units): unknown {
    const data = store.get();
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

  return { listMeets, getMeet, getMeetHighlights };
}

function byPlaceThenTotal(a: Entry, b: Entry): number {
  const ar = a.placeRank;
  const br = b.placeRank;
  if (ar != null && br != null) return ar - br;
  if (ar != null) return -1;
  if (br != null) return 1;
  return (b.totalKg ?? 0) - (a.totalKg ?? 0);
}
