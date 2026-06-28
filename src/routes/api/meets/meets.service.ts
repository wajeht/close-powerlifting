import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import type { Entry } from "../../../data/types";
import { type Pagination, type Units, buildPagination, inUnits } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type {
  GetMeetHighlightsQueryType,
  GetMeetParamType,
  GetMeetQueryType,
  ListMeetsQueryType,
} from "./meets.schema";

const { defaultPerPage } = configuration.pagination;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;

interface MeetRow {
  id: number;
  path: string;
  federation: string;
  parent_federation: string | null;
  date: string;
  meet_name: string;
  meet_country: string | null;
  meet_state: string | null;
  meet_town: string | null;
  sanctioned: number;
}

interface MeetEntryRow {
  username: string;
  name: string;
  sex: Entry["sex"];
  age: number | null;
  event: Entry["event"];
  equipment: Entry["equipment"];
  weight_class_kg: number | null;
  bodyweight_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  dots: number | null;
  place_rank: number | null;
  place_status: string | null;
}

export function createMeetsService(store: DataStoreType) {
  async function listMeets(query: ListMeetsQueryType): Promise<{
    data: unknown[];
    pagination: Pagination;
  }> {
    const { db } = store.get();
    const base = db<MeetRow>("meets");
    applyMeetFilters(base, query);

    const totalRow = await base.clone().count({ count: "*" }).first();
    const total = Number(totalRow?.count ?? 0);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const direction = query.sort === "date-asc" ? "asc" : "desc";
    const rows = await base
      .clone()
      .select(
        "id",
        "path",
        "federation",
        "parent_federation",
        "date",
        "meet_name",
        "meet_country",
        "meet_state",
        "meet_town",
        "sanctioned",
      )
      .orderBy("date", direction)
      .limit(pagination.per_page)
      .offset(pagination.from > 0 ? pagination.from - 1 : 0);

    return { data: rows.map(toMeetSummary), pagination };
  }

  async function getMeet(
    params: GetMeetParamType,
    query: GetMeetQueryType,
  ): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const meet = await lookupMeet(db, params);
    if (meet == null) return null;
    const entries = await meetEntries(db, meet.id, query.sort ?? "place");
    const units: Units = query.units ?? "lbs";

    return {
      path: meet.path,
      meet_name: meet.meet_name,
      federation: meet.federation,
      parent_federation: meet.parent_federation,
      date: meet.date,
      country: meet.meet_country,
      state: meet.meet_state,
      town: meet.meet_town,
      sanctioned: meet.sanctioned === 1,
      results: entries.map((entry) => formatMeetEntry(entry, units)),
    };
  }

  async function getMeetHighlights(
    params: GetMeetParamType,
    query: GetMeetHighlightsQueryType,
  ): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    const meet = await lookupMeet(db, params);
    if (meet == null) return null;
    const entries = await meetEntries(db, meet.id, "place");
    const units: Units = query.units ?? "lbs";

    return {
      path: meet.path,
      meet_name: meet.meet_name,
      federation: meet.federation,
      date: meet.date,
      highlights: {
        best_total: bestByField(entries, "total_kg", units),
        best_squat: bestByField(entries, "best3_squat_kg", units),
        best_bench: bestByField(entries, "best3_bench_kg", units),
        best_deadlift: bestByField(entries, "best3_deadlift_kg", units),
        best_dots: bestByField(entries, "dots", units),
      },
    };
  }

  return { listMeets, getMeet, getMeetHighlights };
}

function applyMeetFilters(
  queryBuilder: Knex.QueryBuilder<MeetRow>,
  query: ListMeetsQueryType,
): void {
  if (query.federation != null) queryBuilder.where("federation_slug", toSlug(query.federation));
  if (query.from != null) queryBuilder.where("date", ">=", query.from);
  if (query.to != null) queryBuilder.where("date", "<=", query.to);
  if (query.country != null)
    queryBuilder.whereRaw("LOWER(meet_country) = ?", [query.country.toLowerCase()]);
  if (query.state != null)
    queryBuilder.whereRaw("LOWER(meet_state) = ?", [query.state.toLowerCase()]);
  if (query.search != null) queryBuilder.where("meet_name", "like", `%${query.search}%`);
}

async function lookupMeet(db: Knex, params: GetMeetParamType): Promise<MeetRow | null> {
  const path = `${params.federation.toLowerCase()}/${params.date}/${params.slug.toLowerCase()}`;
  const row = await db<MeetRow>("meets").where("path", path).first();
  return row ?? null;
}

async function meetEntries(
  db: Knex,
  meetId: number,
  sort: GetMeetQueryType["sort"] | "place",
): Promise<MeetEntryRow[]> {
  const query = db("entries as e")
    .join("lifters as l", "l.id", "e.lifter_id")
    .where("e.meet_id", meetId)
    .select({
      username: "l.username",
      name: "l.name",
      sex: "e.sex",
      age: "e.age",
      event: "e.event",
      equipment: "e.equipment",
      weight_class_kg: "e.weight_class_kg",
      bodyweight_kg: "e.bodyweight_kg",
      best3_squat_kg: "e.best3_squat_kg",
      best3_bench_kg: "e.best3_bench_kg",
      best3_deadlift_kg: "e.best3_deadlift_kg",
      total_kg: "e.total_kg",
      dots: "e.dots",
      place_rank: "e.place_rank",
      place_status: "e.place_status",
    });

  if (sort === "by-total") return query.orderBy("e.total_kg", "desc");
  if (sort === "by-dots") return query.orderBy("e.dots", "desc");
  return query.orderByRaw("e.place_rank IS NULL ASC, e.place_rank ASC, e.total_kg DESC");
}

function toMeetSummary(meet: MeetRow) {
  return {
    path: meet.path,
    meet_name: meet.meet_name,
    federation: meet.federation,
    date: meet.date,
    country: meet.meet_country,
    state: meet.meet_state,
    town: meet.meet_town,
    sanctioned: meet.sanctioned === 1,
  };
}

function formatMeetEntry(entry: MeetEntryRow, units: Units) {
  return {
    username: entry.username,
    name: entry.name,
    sex: entry.sex,
    age: entry.age,
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
}

function bestByField(entries: MeetEntryRow[], field: keyof MeetEntryRow, units: Units): unknown {
  let best: MeetEntryRow | null = null;
  let bestVal = -Infinity;
  for (const entry of entries) {
    const value = entry[field] as number | null;
    if (value == null) continue;
    if (value > bestVal) {
      bestVal = value;
      best = entry;
    }
  }
  if (best == null) return null;
  return {
    username: best.username,
    name: best.name,
    equipment: best.equipment,
    weight_class_kg: best.weight_class_kg,
    value: field === "dots" ? bestVal : inUnits(bestVal, units),
  };
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(REGEX_SLUG_STRIP, "");
}
