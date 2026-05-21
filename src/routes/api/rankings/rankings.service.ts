import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DataStoreType } from "../../../data/store";
import type { Event as PowerliftingEvent, RankMetric } from "../../../data/types";
import { type Pagination, type Units, buildPagination, inUnits } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type {
  GetFilteredRankingsParamType,
  GetFilteredRankingsQueryType,
  GetRankingsType,
} from "./rankings.schema";

const { defaultPerPage } = configuration.pagination;

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

const EVENT_VALUES: Record<string, PowerliftingEvent[]> = {
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
  "by-mcculloch": "dots",
  "by-total": "total",
  "by-squat": "squat",
  "by-bench": "bench",
  "by-deadlift": "deadlift",
};

const METRIC_FIELD: Record<RankMetric, string> = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "total_kg",
  squat: "best3_squat_kg",
  bench: "best3_bench_kg",
  deadlift: "best3_deadlift_kg",
};

interface RankingFilter {
  equipmentValues: string[] | null;
  sex: "M" | "F" | null;
  weightClassKg: number | null;
  yearPrefix: string | null;
  eventValues: PowerliftingEvent[] | null;
  ageClass: string | null;
  federation: string | null;
}

interface RankingRow {
  rank: number;
  username: string;
  name: string;
  sex: "M" | "F" | "Mx" | null;
  age: number | null;
  bodyweight_kg: number | null;
  weight_class_kg: number | null;
  equipment: string;
  event: PowerliftingEvent;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  federation: string;
  path: string;
  meet_name: string;
  date: string;
  lifter_country: string | null;
}

interface RankingRowWithTotal extends RankingRow {
  total_count: number;
}

export function createRankingsService(store: DataStoreType) {
  function getRankings(query: GetRankingsType): { data: unknown[]; pagination: Pagination } {
    const db = store.get();
    const units: Units = query.units ?? "lbs";
    const federation = query.federation?.toLowerCase() ?? null;
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;

    if (federation == null) {
      const total = scalarCount(db, "SELECT COUNT(*) AS count FROM rankings WHERE metric = ?", [
        "dots",
      ]);
      const pagination = buildPagination(total, currentPage, perPage);
      const rows = queryPrecomputedRankings(db, "dots", pagination.per_page, offset(pagination));
      return { data: rows.map((row) => formatRankingRow(row, units)), pagination };
    }

    const filter = emptyFilter({ federation });
    const result = queryFilteredRankings(db, "dots", filter, perPage, (currentPage - 1) * perPage);
    const pagination = buildPagination(result.total, currentPage, perPage);
    return { data: result.rows.map((row) => formatRankingRow(row, units)), pagination };
  }

  function getFilteredRankings(
    params: GetFilteredRankingsParamType,
    query: GetFilteredRankingsQueryType,
  ): { data: unknown[]; pagination: Pagination } {
    const db = store.get();
    const units: Units = query.units ?? "lbs";
    const metric: RankMetric = params.sort != null ? SORT_TO_METRIC[params.sort]! : "dots";
    const filter: RankingFilter = {
      equipmentValues: params.equipment != null ? EQUIPMENT_VALUES[params.equipment]! : null,
      sex: params.sex != null ? SEX_VALUES[params.sex]! : null,
      weightClassKg: parseWeightClass(params.weight_class),
      yearPrefix: params.year != null ? `${params.year}-` : null,
      eventValues: params.event != null ? EVENT_VALUES[params.event]! : null,
      ageClass: query.age_class ?? null,
      federation: query.federation?.toLowerCase() ?? null,
    };

    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const result = queryFilteredRankings(db, metric, filter, perPage, (currentPage - 1) * perPage);
    const pagination = buildPagination(result.total, currentPage, perPage);
    return { data: result.rows.map((row) => formatRankingRow(row, units)), pagination };
  }

  function getRank(rank: number): Record<string, unknown> | null {
    const row = queryPrecomputedRank(store.get(), "dots", rank);
    return row == null ? null : formatRankingRow(row, "lbs");
  }

  function getMaxRank(): number {
    return scalarCount(store.get(), "SELECT COUNT(*) AS count FROM rankings WHERE metric = ?", [
      "dots",
    ]);
  }

  return { getRankings, getFilteredRankings, getRank, getMaxRank };
}

function emptyFilter(overrides: Partial<RankingFilter>): RankingFilter {
  return {
    equipmentValues: null,
    sex: null,
    weightClassKg: null,
    yearPrefix: null,
    eventValues: null,
    ageClass: null,
    federation: null,
    ...overrides,
  };
}

function queryPrecomputedRankings(
  db: DatabaseSync,
  metric: RankMetric,
  limit: number,
  offsetValue: number,
): RankingRow[] {
  return db
    .prepare(`${rankingSelectSql()} WHERE r.metric = ? ORDER BY r.rank LIMIT ? OFFSET ?`)
    .all(metric, limit, offsetValue) as unknown as RankingRow[];
}

function queryPrecomputedRank(
  db: DatabaseSync,
  metric: RankMetric,
  rank: number,
): RankingRow | null {
  const row = db
    .prepare(`${rankingSelectSql()} WHERE r.metric = ? AND r.rank = ?`)
    .get(metric, rank) as RankingRow | undefined;
  return row ?? null;
}

function queryFilteredRankings(
  db: DatabaseSync,
  metric: RankMetric,
  filter: RankingFilter,
  limit: number,
  offsetValue: number,
): { rows: RankingRow[]; total: number } {
  const built = buildFilteredRankingSql(metric, filter);
  const rows = db
    .prepare(
      `${built.sql}
       SELECT COUNT(*) OVER () AS total_count, ${rankingColumns("ranked.rank")}
       FROM ranked
       JOIN entries e ON e.id = ranked.entry_id
       JOIN lifters l ON l.id = e.lifter_id
       JOIN meets m ON m.id = e.meet_id
       ORDER BY ranked.rank
       LIMIT ? OFFSET ?`,
    )
    .all(...built.params, limit, offsetValue) as unknown as RankingRowWithTotal[];
  return {
    rows,
    total: rows[0]?.total_count ?? (offsetValue > 0 ? filteredRankingCount(db, built) : 0),
  };
}

function filteredRankingCount(
  db: DatabaseSync,
  built: { sql: string; params: SQLInputValue[] },
): number {
  return scalarCount(db, `${built.sql} SELECT COUNT(*) AS count FROM ranked`, built.params);
}

function buildFilteredRankingSql(
  metric: RankMetric,
  filter: RankingFilter,
): {
  sql: string;
  params: SQLInputValue[];
} {
  const field = METRIC_FIELD[metric];
  const clauses = [`e.${field} IS NOT NULL`];
  const params: SQLInputValue[] = [];
  addFilterClauses(clauses, params, filter);
  return {
    sql: `
      WITH best AS (
        SELECT
          e.lifter_id,
          e.id AS entry_id,
          e.${field} AS value,
          ROW_NUMBER() OVER (
            PARTITION BY e.lifter_id
            ORDER BY e.${field} DESC, e.id ASC
          ) AS best_rank
        FROM entries e
        JOIN meets m ON m.id = e.meet_id
        WHERE ${clauses.join(" AND ")}
      ),
      ranked AS (
        SELECT
          lifter_id,
          entry_id,
          value,
          ROW_NUMBER() OVER (ORDER BY value DESC, lifter_id ASC) AS rank
        FROM best
        WHERE best_rank = 1
      )
    `,
    params,
  };
}

function addFilterClauses(clauses: string[], params: SQLInputValue[], filter: RankingFilter): void {
  if (filter.equipmentValues != null) {
    addInClause(clauses, params, "e.equipment", filter.equipmentValues);
  }
  if (filter.sex != null) {
    clauses.push("e.sex = ?");
    params.push(filter.sex);
  }
  if (filter.weightClassKg != null) {
    clauses.push("e.weight_class_kg = ?");
    params.push(filter.weightClassKg);
  }
  if (filter.eventValues != null) addInClause(clauses, params, "e.event", filter.eventValues);
  if (filter.ageClass != null) {
    clauses.push("e.age_class = ?");
    params.push(filter.ageClass);
  }
  if (filter.yearPrefix != null) {
    clauses.push("m.date LIKE ?");
    params.push(`${filter.yearPrefix}%`);
  }
  if (filter.federation != null) {
    clauses.push("m.federation_slug = ?");
    params.push(filter.federation);
  }
}

function addInClause(
  clauses: string[],
  params: SQLInputValue[],
  field: string,
  values: string[],
): void {
  clauses.push(`${field} IN (${values.map(() => "?").join(", ")})`);
  params.push(...values);
}

function rankingSelectSql(): string {
  return `
    SELECT ${rankingColumns("r.rank")}
    FROM rankings r
    JOIN entries e ON e.id = r.entry_id
    JOIN lifters l ON l.id = e.lifter_id
    JOIN meets m ON m.id = e.meet_id
  `;
}

function rankingColumns(rankExpr: string): string {
  return `
    ${rankExpr} AS rank,
    l.username,
    l.name,
    e.sex,
    e.age,
    e.bodyweight_kg,
    e.weight_class_kg,
    e.equipment,
    e.event,
    e.best3_squat_kg,
    e.best3_bench_kg,
    e.best3_deadlift_kg,
    e.total_kg,
    e.dots,
    e.wilks,
    e.glossbrenner,
    e.goodlift,
    e.lifter_country,
    m.federation,
    m.path,
    m.meet_name,
    m.date
  `;
}

function parseWeightClass(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function formatRankingRow(row: RankingRow, units: Units): Record<string, unknown> {
  return {
    rank: row.rank,
    username: row.username,
    name: row.name,
    sex: row.sex,
    age: row.age,
    bodyweight: inUnits(row.bodyweight_kg, units),
    weight_class_kg: row.weight_class_kg,
    equipment: row.equipment,
    event: row.event,
    squat: inUnits(row.best3_squat_kg, units),
    bench: inUnits(row.best3_bench_kg, units),
    deadlift: inUnits(row.best3_deadlift_kg, units),
    total: inUnits(row.total_kg, units),
    dots: row.dots,
    wilks: row.wilks,
    glossbrenner: row.glossbrenner,
    goodlift: row.goodlift,
    federation: row.federation,
    meet_path: row.path,
    meet_name: row.meet_name,
    meet_date: row.date,
    country: row.lifter_country,
    units,
  };
}

function scalarCount(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): number {
  const row = db.prepare(sql).get(...params) as { count: number } | undefined;
  return row?.count ?? 0;
}

function offset(pagination: Pagination): number {
  return (pagination.current_page - 1) * pagination.per_page;
}
