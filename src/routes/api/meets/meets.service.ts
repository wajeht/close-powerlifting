import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DataStoreType } from "../../../data/store";
import { type Pagination, type Units, buildPagination, inUnits } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type {
  GetMeetHighlightsQueryType,
  GetMeetParamType,
  GetMeetQueryType,
  ListMeetsQueryType,
} from "./meets.schema";

const { defaultPerPage } = configuration.pagination;

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
  sex: string | null;
  age: number | null;
  event: string;
  equipment: string;
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

interface HighlightRow extends MeetEntryRow {
  value: number;
}

export function createMeetsService(store: DataStoreType) {
  function listMeets(query: ListMeetsQueryType): { data: unknown[]; pagination: Pagination } {
    const db = store.get();
    const { where, params } = buildMeetFilters(query);
    const total = scalarCount(db, `SELECT COUNT(*) AS count FROM meets ${where}`, params);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const direction = query.sort === "date-asc" ? "ASC" : "DESC";
    const rows = db
      .prepare(
        `SELECT ${meetColumns()} FROM meets ${where} ORDER BY date ${direction}, id LIMIT ? OFFSET ?`,
      )
      .all(...params, pagination.per_page, offset(pagination)) as unknown as MeetRow[];
    return { data: rows.map(toMeetSummary), pagination };
  }

  function getMeet(
    params: GetMeetParamType,
    query: GetMeetQueryType,
  ): Record<string, unknown> | null {
    const db = store.get();
    const meet = lookupMeet(db, params);
    if (meet == null) return null;
    const units: Units = query.units ?? "lbs";
    const sort = query.sort ?? "place";
    const rows = db
      .prepare(`${meetEntrySelectSql()} WHERE e.meet_id = ? ORDER BY ${entryOrderBy(sort)}`)
      .all(meet.id) as unknown as MeetEntryRow[];

    return {
      path: meet.path,
      meet_name: meet.meet_name,
      federation: meet.federation,
      parent_federation: meet.parent_federation,
      date: meet.date,
      country: meet.meet_country,
      state: meet.meet_state,
      town: meet.meet_town,
      sanctioned: Boolean(meet.sanctioned),
      results: rows.map((entry) => formatMeetEntry(entry, units)),
    };
  }

  function getMeetHighlights(
    params: GetMeetParamType,
    query: GetMeetHighlightsQueryType,
  ): Record<string, unknown> | null {
    const db = store.get();
    const meet = lookupMeet(db, params);
    if (meet == null) return null;
    const units: Units = query.units ?? "lbs";

    return {
      path: meet.path,
      meet_name: meet.meet_name,
      federation: meet.federation,
      date: meet.date,
      highlights: {
        best_total: bestByField(db, meet.id, "total_kg", units),
        best_squat: bestByField(db, meet.id, "best3_squat_kg", units),
        best_bench: bestByField(db, meet.id, "best3_bench_kg", units),
        best_deadlift: bestByField(db, meet.id, "best3_deadlift_kg", units),
        best_dots: bestByField(db, meet.id, "dots", units),
      },
    };
  }

  return { listMeets, getMeet, getMeetHighlights };
}

function buildMeetFilters(query: ListMeetsQueryType): { where: string; params: SQLInputValue[] } {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (query.federation != null) {
    clauses.push("federation_slug = ?");
    params.push(query.federation.toLowerCase());
  }
  if (query.from != null) {
    clauses.push("date >= ?");
    params.push(query.from);
  }
  if (query.to != null) {
    clauses.push("date <= ?");
    params.push(query.to);
  }
  if (query.country != null) {
    clauses.push("lower(coalesce(meet_country, '')) = ?");
    params.push(query.country.toLowerCase());
  }
  if (query.state != null) {
    clauses.push("lower(coalesce(meet_state, '')) = ?");
    params.push(query.state.toLowerCase());
  }
  if (query.search != null) {
    clauses.push("lower(meet_name) LIKE ?");
    params.push(`%${query.search.toLowerCase()}%`);
  }
  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function lookupMeet(db: DatabaseSync, params: GetMeetParamType): MeetRow | null {
  const path = `${params.federation.toLowerCase()}/${params.date}/${params.slug.toLowerCase()}`;
  const row = db.prepare(`SELECT ${meetColumns()} FROM meets WHERE path = ?`).get(path) as
    | MeetRow
    | undefined;
  return row ?? null;
}

function meetColumns(): string {
  return `
    id,
    path,
    federation,
    parent_federation,
    date,
    meet_name,
    meet_country,
    meet_state,
    meet_town,
    sanctioned
  `;
}

function toMeetSummary(row: MeetRow) {
  return {
    path: row.path,
    meet_name: row.meet_name,
    federation: row.federation,
    date: row.date,
    country: row.meet_country,
    state: row.meet_state,
    town: row.meet_town,
    sanctioned: Boolean(row.sanctioned),
  };
}

function meetEntrySelectSql(): string {
  return `
    SELECT
      l.username,
      l.name,
      e.sex,
      e.age,
      e.event,
      e.equipment,
      e.weight_class_kg,
      e.bodyweight_kg,
      e.best3_squat_kg,
      e.best3_bench_kg,
      e.best3_deadlift_kg,
      e.total_kg,
      e.dots,
      e.place_rank,
      e.place_status
    FROM entries e
    JOIN lifters l ON l.id = e.lifter_id
  `;
}

function entryOrderBy(sort: string): string {
  if (sort === "by-total") return "e.total_kg DESC";
  if (sort === "by-dots") return "e.dots DESC";
  return "(e.place_rank IS NULL), e.place_rank ASC, e.total_kg DESC";
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

function bestByField(
  db: DatabaseSync,
  meetId: number,
  field: "total_kg" | "best3_squat_kg" | "best3_bench_kg" | "best3_deadlift_kg" | "dots",
  units: Units,
): unknown {
  const row = db
    .prepare(
      `
      SELECT
        l.username,
        l.name,
        e.sex,
        e.age,
        e.event,
        e.equipment,
        e.weight_class_kg,
        e.bodyweight_kg,
        e.best3_squat_kg,
        e.best3_bench_kg,
        e.best3_deadlift_kg,
        e.total_kg,
        e.dots,
        e.place_rank,
        e.place_status,
        e.${field} AS value
      FROM entries e
      JOIN lifters l ON l.id = e.lifter_id
      WHERE e.meet_id = ? AND e.${field} IS NOT NULL
      ORDER BY e.${field} DESC
      LIMIT 1
    `,
    )
    .get(meetId) as HighlightRow | undefined;
  if (row == null) return null;
  return {
    username: row.username,
    name: row.name,
    equipment: row.equipment,
    weight_class_kg: row.weight_class_kg,
    value: field === "dots" ? row.value : inUnits(row.value, units),
  };
}

function scalarCount(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): number {
  const row = db.prepare(sql).get(...params) as { count: number } | undefined;
  return row?.count ?? 0;
}

function offset(pagination: Pagination): number {
  return (pagination.current_page - 1) * pagination.per_page;
}
