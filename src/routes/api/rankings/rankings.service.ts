import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import type { Entry, RankMetric } from "../../../data/types";
import { fieldForRankMetric } from "../../../data/leaderboard-definitions";
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
  "by-mcculloch": "dots",
  "by-total": "total",
  "by-squat": "squat",
  "by-bench": "bench",
  "by-deadlift": "deadlift",
};

const REGEX_SLUG_STRIP = /[^a-z0-9]/g;

interface RankingFilter {
  equipmentValues: string[] | null;
  sex: "M" | "F" | null;
  weightClassKg: number | null;
  yearPrefix: string | null;
  eventValues: Entry["event"][] | null;
  ageClass: string | null;
  federation: string | null;
}

interface RankingRow {
  rank: number;
  username: string;
  name: string;
  sex: Entry["sex"];
  age: number | null;
  bodyweight_kg: number | null;
  weight_class_kg: number | null;
  equipment: Entry["equipment"];
  event: Entry["event"];
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  federation: string;
  meet_path: string;
  meet_name: string;
  meet_date: string;
  lifter_country: string | null;
}

interface CountRow {
  count: string | number;
}

export function createRankingsService(store: DataStoreType) {
  async function getRankings(query: GetRankingsType): Promise<{
    data: unknown[];
    pagination: Pagination;
  }> {
    const { db } = store.get();
    const units: Units = query.units ?? "lbs";
    const federation = query.federation == null ? null : toSlug(query.federation);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;

    if (federation == null) {
      const total = await countGlobalRanking(db, "dots");
      const pagination = buildPagination(total, currentPage, perPage);
      const rows = await selectGlobalRanking(db, "dots", pagination);
      return {
        data: rows.map((row) => buildRankingRow(row, units)),
        pagination,
      };
    }

    return filteredRankingWithPagination(
      db,
      "dots",
      emptyFilter({ federation }),
      units,
      currentPage,
      perPage,
    );
  }

  async function getFilteredRankings(
    params: GetFilteredRankingsParamType,
    query: GetFilteredRankingsQueryType,
  ): Promise<{ data: unknown[]; pagination: Pagination }> {
    const { db } = store.get();
    const units: Units = query.units ?? "lbs";
    const metric: RankMetric = params.sort != null ? SORT_TO_METRIC[params.sort]! : "dots";
    const filter: RankingFilter = {
      equipmentValues: params.equipment != null ? EQUIPMENT_VALUES[params.equipment]! : null,
      sex: params.sex != null ? SEX_VALUES[params.sex]! : null,
      weightClassKg: parseWeightClass(params.weight_class),
      yearPrefix: params.year != null ? `${params.year}-` : null,
      eventValues: params.event != null ? EVENT_VALUES[params.event]! : null,
      ageClass: query.age_class ?? null,
      federation: query.federation == null ? null : toSlug(query.federation),
    };

    return filteredRankingWithPagination(
      db,
      metric,
      filter,
      units,
      query.current_page ?? 1,
      query.per_page ?? defaultPerPage,
    );
  }

  async function getRank(rank: number): Promise<Record<string, unknown> | null> {
    const { db } = store.get();
    if (rank < 1) return null;
    const rows = await selectGlobalRanking(db, "dots", {
      ...buildPagination(rank, rank, 1),
      current_page: rank,
      per_page: 1,
      from: rank,
      to: rank,
    });
    return rows[0] == null ? null : buildRankingRow(rows[0], "lbs");
  }

  async function getMaxRank(): Promise<number> {
    return countGlobalRanking(store.get().db, "dots");
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

async function countGlobalRanking(db: Knex, metric: RankMetric): Promise<number> {
  const row = await db<CountRow>("lifter_bests")
    .where("metric", metric)
    .count({ count: "*" })
    .first();
  return Number(row?.count ?? 0);
}

async function selectGlobalRanking(
  db: Knex,
  metric: RankMetric,
  pagination: Pagination,
): Promise<RankingRow[]> {
  return db("lifter_bests as lb")
    .join("entries as e", "e.id", "lb.entry_id")
    .join("lifters as l", "l.id", "lb.lifter_id")
    .join("meets as m", "m.id", "e.meet_id")
    .where("lb.metric", metric)
    .orderBy("lb.rank", "asc")
    .limit(pagination.per_page)
    .offset(pagination.from > 0 ? pagination.from - 1 : 0)
    .select({
      rank: "lb.rank",
      username: "l.username",
      name: "l.name",
      sex: "e.sex",
      age: "e.age",
      bodyweight_kg: "e.bodyweight_kg",
      weight_class_kg: "e.weight_class_kg",
      equipment: "e.equipment",
      event: "e.event",
      best3_squat_kg: "e.best3_squat_kg",
      best3_bench_kg: "e.best3_bench_kg",
      best3_deadlift_kg: "e.best3_deadlift_kg",
      total_kg: "e.total_kg",
      dots: "e.dots",
      wilks: "e.wilks",
      glossbrenner: "e.glossbrenner",
      goodlift: "e.goodlift",
      federation: "m.federation",
      meet_path: "m.path",
      meet_name: "m.meet_name",
      meet_date: "m.date",
      lifter_country: "e.lifter_country",
    });
}

async function filteredRankingWithPagination(
  db: Knex,
  metric: RankMetric,
  filter: RankingFilter,
  units: Units,
  currentPage: number,
  perPage: number,
): Promise<{ data: unknown[]; pagination: Pagination }> {
  const total = await countFilteredRanking(db, metric, filter);
  const pagination = buildPagination(total, currentPage, perPage);
  const rows = await selectFilteredRanking(db, metric, filter, pagination);
  return {
    data: rows.map((row) => buildRankingRow(row, units)),
    pagination,
  };
}

async function countFilteredRanking(
  db: Knex,
  metric: RankMetric,
  filter: RankingFilter,
): Promise<number> {
  const { sql, bindings } = filteredRankingSql(metric, filter, "COUNT(*) AS count");
  const result = await db.raw<CountRow[]>(sql, bindings);
  return Number(result[0]?.count ?? 0);
}

async function selectFilteredRanking(
  db: Knex,
  metric: RankMetric,
  filter: RankingFilter,
  pagination: Pagination,
): Promise<RankingRow[]> {
  const { sql, bindings } = filteredRankingSql(
    metric,
    filter,
    `
      rank, username, name, sex, age, bodyweight_kg, weight_class_kg,
      equipment, event, best3_squat_kg, best3_bench_kg, best3_deadlift_kg,
      total_kg, dots, wilks, glossbrenner, goodlift, federation, meet_path,
      meet_name, meet_date, lifter_country
    `,
  );
  return db.raw<RankingRow[]>(
    `${sql} ORDER BY rank ASC LIMIT ? OFFSET ?`,
    bindings.concat([pagination.per_page, pagination.from > 0 ? pagination.from - 1 : 0]),
  );
}

function filteredRankingSql(
  metric: RankMetric,
  filter: RankingFilter,
  selectClause: string,
): { sql: string; bindings: Knex.RawBinding[] } {
  const field = fieldForRankMetric(metric);
  const where = [`e.${field} IS NOT NULL`];
  const bindings: Knex.RawBinding[] = [];

  if (filter.equipmentValues != null) {
    where.push(`e.equipment IN (${filter.equipmentValues.map(() => "?").join(", ")})`);
    bindings.push(...filter.equipmentValues);
  }
  if (filter.sex != null) {
    where.push("e.sex = ?");
    bindings.push(filter.sex);
  }
  if (filter.weightClassKg != null) {
    where.push("e.weight_class_kg = ?");
    bindings.push(filter.weightClassKg);
  }
  if (filter.eventValues != null) {
    where.push(`e.event IN (${filter.eventValues.map(() => "?").join(", ")})`);
    bindings.push(...filter.eventValues);
  }
  if (filter.ageClass != null) {
    where.push("e.age_class = ?");
    bindings.push(filter.ageClass);
  }
  if (filter.yearPrefix != null) {
    where.push("m.date LIKE ?");
    bindings.push(`${filter.yearPrefix}%`);
  }
  if (filter.federation != null) {
    where.push("m.federation_slug = ?");
    bindings.push(filter.federation);
  }

  return {
    sql: `
      WITH candidates AS (
        SELECT
          e.id AS entry_id,
          e.lifter_id,
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
          m.path AS meet_path,
          m.meet_name,
          m.date AS meet_date,
          l.username,
          l.name,
          e.${field} AS value,
          ROW_NUMBER() OVER (
            PARTITION BY e.lifter_id
            ORDER BY e.${field} DESC, e.id ASC
          ) AS lifter_rank
        FROM entries e
        JOIN meets m ON m.id = e.meet_id
        JOIN lifters l ON l.id = e.lifter_id
        WHERE ${where.join(" AND ")}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY value DESC, entry_id ASC) AS rank
        FROM candidates
        WHERE lifter_rank = 1
      )
      SELECT ${selectClause}
      FROM ranked
    `,
    bindings,
  };
}

function parseWeightClass(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(REGEX_SLUG_STRIP, "");
}

function buildRankingRow(row: RankingRow, units: Units) {
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
    meet_path: row.meet_path,
    meet_name: row.meet_name,
    meet_date: row.meet_date,
    country: row.lifter_country,
    units,
  };
}
