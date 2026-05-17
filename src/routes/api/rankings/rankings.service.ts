import type { Knex } from "knex";

import { configuration } from "../../../configuration";
import type { RankingRow, ApiResponse, Pagination } from "../../../types";
import { nameToSlug } from "../../../utils/ingest";
import type {
  GetRankingsType,
  GetRankType,
  GetFilteredRankingsParamType,
  GetFilteredRankingsQueryType,
} from "./rankings.validation";

const { defaultPerPage } = configuration.pagination;
const KG_TO_LBS = 2.20462;

const EQUIPMENT_MAP: Record<string, string[]> = {
  raw: ["Raw"],
  wraps: ["Wraps"],
  "raw-wraps": ["Raw", "Wraps"],
  "single-ply": ["Single-ply"],
  "multi-ply": ["Multi-ply"],
  unlimited: ["Unlimited"],
};

const SEX_MAP: Record<string, string> = {
  men: "M",
  women: "F",
};

const EVENT_MAP: Record<string, string> = {
  "full-power": "SBD",
  "push-pull": "BD",
  squat: "S",
  bench: "B",
  deadlift: "D",
};

const SORT_COLUMN: Record<string, string> = {
  "by-dots": "dots",
  "by-wilks": "wilks",
  "by-glossbrenner": "glossbrenner",
  "by-goodlift": "goodlift",
  "by-mcculloch": "dots",
  "by-total": "total_kg",
  "by-squat": "best3_squat_kg",
  "by-bench": "best3_bench_kg",
  "by-deadlift": "best3_deadlift_kg",
};

// Filters whose semantics live entirely on `lifter_bests` rows (the "best
// lift per lifter per event/equipment"). When ONLY these are set, we serve
// from the materialized table and skip the 3.9M-row window. Anything else
// (weight_class, year, age_class, federation) needs the per-lift detail and
// falls back to the slow path.
const BESTS_PATH_FILTERS = new Set(["equipment", "sex", "event", "sort"]);

interface RankingsFilters {
  equipment?: string;
  sex?: string;
  weightClass?: string;
  year?: string;
  event?: string;
  ageClass?: string;
  federation?: string;
  sort?: string;
}

function applyFilters(query: Knex.QueryBuilder, filters: RankingsFilters): Knex.QueryBuilder {
  if (filters.equipment) {
    const mapped = EQUIPMENT_MAP[filters.equipment];
    if (mapped) query = query.whereIn("lifts.equipment", mapped);
  }

  if (filters.sex) {
    const mapped = SEX_MAP[filters.sex];
    if (mapped) query = query.where("lifters.sex", mapped);
  }

  if (filters.event) {
    const mapped = EVENT_MAP[filters.event];
    if (mapped) query = query.where("lifts.event", mapped);
  }

  if (filters.weightClass) {
    const numeric = parseFloat(filters.weightClass);
    if (Number.isFinite(numeric)) query = query.where("lifts.weight_class_kg", numeric);
  }

  if (filters.year) {
    query = query.where("meets.date", "like", `${filters.year}-%`);
  }

  if (filters.ageClass) {
    query = query.where("lifts.age_class", filters.ageClass);
  }

  if (filters.federation) {
    const slug = nameToSlug(filters.federation);
    query = query.where((qb) =>
      qb.where("federations.slug", slug).orWhere("federations.parent_slug", slug),
    );
  }

  return query;
}

function joinedLiftsBase(knex: Knex): Knex.QueryBuilder {
  return knex("lifts")
    .join("lifters", "lifters.id", "lifts.lifter_id")
    .join("meets", "meets.id", "lifts.meet_id")
    .join("federations", "federations.id", "meets.federation_id");
}

export interface LiftRow {
  name: string;
  name_slug: string;
  sex: string | null;
  instagram: string | null;
  event: string | null;
  equipment: string | null;
  age: number | null;
  bodyweight_kg: number | null;
  weight_class_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  federation: string | null;
  parent_federation: string | null;
  date: string;
  meet_country: string | null;
  meet_state: string | null;
  meet_name: string | null;
}

function convertKg(value: number | null, units: "kg" | "lbs"): number {
  if (value == null) return 0;
  return units === "lbs" ? Number((value * KG_TO_LBS).toFixed(2)) : value;
}

export function liftRowToRankingRow(row: LiftRow, rank: number, units: "kg" | "lbs"): RankingRow {
  const username = row.name_slug ?? nameToSlug(row.name);
  const meetCode = row.meet_name
    ? `${(row.federation ?? "").toLowerCase()}/${row.date}/${nameToSlug(row.meet_name)}`
    : "";
  const instagram = row.instagram ?? "";

  return {
    id: 0,
    rank,
    full_name: row.name,
    username,
    user_profile: `/api/users/${username}`,
    instagram,
    instagram_url: instagram ? `https://www.instagram.com/${instagram}` : "",
    username_color: "",
    country: row.meet_country ?? "",
    location: row.meet_country
      ? `${row.meet_country}${row.meet_state ? `-${row.meet_state}` : ""}`
      : "",
    fed: row.federation ?? "",
    federation_url: row.federation ? `/api/federations/${row.federation.toLowerCase()}` : "",
    date: row.date,
    country_two: row.meet_country ?? "",
    state: row.meet_state ?? "",
    meet_code: meetCode,
    meet_url: meetCode ? `/api/meets/${meetCode}` : "",
    sex: row.sex ?? "",
    equip: row.equipment ?? "",
    age: Math.floor(row.age ?? 0),
    open: "",
    body_weight: convertKg(row.bodyweight_kg, units),
    weight_class: convertKg(row.weight_class_kg, units),
    squat: convertKg(row.best3_squat_kg, units),
    bench: convertKg(row.best3_bench_kg, units),
    deadlift: convertKg(row.best3_deadlift_kg, units),
    total: convertKg(row.total_kg, units),
    dots: row.dots ?? 0,
  };
}

function normalizeUnits(units: string | undefined): "kg" | "lbs" {
  return units === "kg" ? "kg" : "lbs";
}

// True when the filter set can be answered entirely from lifter_bests + a
// constant number of joins (≤ perPage rows). False forces the slow path
// because the filter references columns we didn't denormalize.
function canUseBestsPath(filters: RankingsFilters): boolean {
  for (const key of Object.keys(filters) as (keyof RankingsFilters)[]) {
    const value = filters[key];
    if (value == null || value === "") continue;
    if (!BESTS_PATH_FILTERS.has(key)) return false;
  }
  return true;
}

export function createRankingService(knex: Knex) {
  // Fast path for `/api/rankings` (and event/equipment/sex variants): read
  // pre-aggregated rows from `lifter_bests` instead of windowing over 3.9M
  // `lifts` rows. Backs the ranking column with a single descending index,
  // so total cost is COUNT + indexed walk + ≤50 joined rows.
  async function queryRankingsFromBests(
    filters: RankingsFilters,
    currentPage: number,
    perPage: number,
    units: "kg" | "lbs",
    sortColumn: string,
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    const offset = (currentPage - 1) * perPage;

    function applyBestsFilters(query: Knex.QueryBuilder): Knex.QueryBuilder {
      let q = query.whereNotNull(`lifter_bests.${sortColumn}`);
      if (filters.equipment) {
        const mapped = EQUIPMENT_MAP[filters.equipment];
        if (mapped) q = q.whereIn("lifter_bests.equipment", mapped);
      }
      if (filters.event) {
        const mapped = EVENT_MAP[filters.event];
        if (mapped) q = q.where("lifter_bests.event", mapped);
      }
      if (filters.sex) {
        const mapped = SEX_MAP[filters.sex];
        if (mapped) q = q.where("lifters.sex", mapped);
      }
      return q;
    }

    const needsLiftersJoin = filters.sex != null;
    function baseQuery(): Knex.QueryBuilder {
      const q = knex("lifter_bests");
      return needsLiftersJoin ? q.join("lifters", "lifters.id", "lifter_bests.lifter_id") : q;
    }

    const totalResult = await applyBestsFilters(baseQuery())
      .count<{ count: number | string }[]>({ count: "lifter_bests.lifter_id" })
      .first();
    const totalLength = Number(totalResult?.count ?? 0);
    if (totalLength === 0) return { rows: [], totalLength: 0 };

    const rows = (await applyBestsFilters(
      knex("lifter_bests")
        .join("lifts", "lifts.id", "lifter_bests.best_lift_id")
        .join("lifters", "lifters.id", "lifter_bests.lifter_id")
        .join("meets", "meets.id", "lifts.meet_id")
        .join("federations", "federations.id", "meets.federation_id"),
    )
      .orderBy(`lifter_bests.${sortColumn}`, "desc")
      .limit(perPage)
      .offset(offset)
      .select(
        knex.ref("lifters.name").as("name"),
        knex.ref("lifters.name_slug").as("name_slug"),
        knex.ref("lifters.sex").as("sex"),
        knex.ref("lifters.instagram").as("instagram"),
        "lifts.event",
        "lifts.equipment",
        "lifts.age",
        "lifts.bodyweight_kg",
        "lifts.weight_class_kg",
        "lifts.best3_squat_kg",
        "lifts.best3_bench_kg",
        "lifts.best3_deadlift_kg",
        "lifts.total_kg",
        "lifts.dots",
        "lifts.wilks",
        "lifts.glossbrenner",
        "lifts.goodlift",
        knex.ref("federations.code").as("federation"),
        knex.ref("federations.parent_slug").as("parent_federation"),
        "meets.date",
        "meets.meet_country",
        "meets.meet_state",
        "meets.meet_name",
      )) as LiftRow[];

    return {
      rows: rows.map((row, idx) => liftRowToRankingRow(row, offset + idx + 1, units)),
      totalLength,
    };
  }

  async function queryRankings(
    filters: RankingsFilters,
    currentPage: number,
    perPage: number,
    units: "kg" | "lbs",
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    const sortColumn = SORT_COLUMN[filters.sort ?? "by-dots"] ?? "dots";

    if (canUseBestsPath(filters)) {
      return queryRankingsFromBests(filters, currentPage, perPage, units, sortColumn);
    }

    const offset = (currentPage - 1) * perPage;

    const filteredBase = applyFilters(joinedLiftsBase(knex), filters).whereNotNull(
      `lifts.${sortColumn}`,
    );

    const totalResult = await filteredBase
      .clone()
      .countDistinct({ count: "lifters.id" })
      .first<{ count: number | string }>();
    const totalLength = Number(totalResult?.count ?? 0);

    if (totalLength === 0) {
      return { rows: [], totalLength: 0 };
    }

    const innerQuery = applyFilters(joinedLiftsBase(knex), filters)
      .whereNotNull(`lifts.${sortColumn}`)
      .select(
        knex.ref("lifters.name").as("name"),
        knex.ref("lifters.name_slug").as("name_slug"),
        knex.ref("lifters.sex").as("sex"),
        knex.ref("lifters.instagram").as("instagram"),
        "lifts.event",
        "lifts.equipment",
        "lifts.age",
        "lifts.bodyweight_kg",
        "lifts.weight_class_kg",
        "lifts.best3_squat_kg",
        "lifts.best3_bench_kg",
        "lifts.best3_deadlift_kg",
        "lifts.total_kg",
        "lifts.dots",
        "lifts.wilks",
        "lifts.glossbrenner",
        "lifts.goodlift",
        knex.ref("federations.code").as("federation"),
        knex.ref("federations.parent_slug").as("parent_federation"),
        "meets.date",
        "meets.meet_country",
        "meets.meet_state",
        "meets.meet_name",
        knex.raw(
          `ROW_NUMBER() OVER (PARTITION BY lifters.id ORDER BY lifts.${sortColumn} DESC) AS rn`,
        ),
      );

    const deduped = (await knex
      .select<LiftRow[]>("*")
      .from(innerQuery.as("ranked"))
      .where("rn", 1)
      .orderBy(sortColumn, "desc")
      .limit(perPage)
      .offset(offset)) as LiftRow[];

    const rows = deduped.map((row, idx) => liftRowToRankingRow(row, offset + idx + 1, units));
    return { rows, totalLength };
  }

  async function getRankings({
    current_page = 1,
    per_page = defaultPerPage,
    units = "lbs",
    federation,
  }: GetRankingsType): Promise<ApiResponse<RankingRow[]> & { pagination?: Pagination }> {
    const result = await queryRankings(
      { federation },
      current_page,
      per_page,
      normalizeUnits(units),
    );

    if (result.totalLength === 0 && result.rows.length === 0) {
      return { data: [], pagination: calculatePagination(0, current_page, per_page) };
    }

    return {
      data: result.rows,
      pagination: calculatePagination(result.totalLength, current_page, per_page),
    };
  }

  async function getRank({ rank }: GetRankType): Promise<RankingRow | null> {
    const rankNum = parseInt(rank, 10);
    if (isNaN(rankNum) || rankNum < 1) return null;

    const perPage = defaultPerPage;
    const currentPage = Math.ceil(rankNum / perPage);
    const indexInPage = (rankNum - 1) % perPage;

    const result = await getRankings({ current_page: currentPage, per_page: perPage });
    if (!result.data || !result.data[indexInPage]) return null;
    return result.data[indexInPage];
  }

  async function getFilteredRankings(
    filters: GetFilteredRankingsParamType,
    query: GetFilteredRankingsQueryType,
  ): Promise<ApiResponse<RankingRow[]> & { pagination?: Pagination }> {
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const units = normalizeUnits(query.units);

    const combined: RankingsFilters = {
      equipment: filters.equipment,
      sex: filters.sex,
      weightClass: filters.weight_class,
      year: filters.year,
      event: filters.event,
      ageClass: query.age_class,
      federation: query.federation,
      sort: filters.sort,
    };

    const result = await queryRankings(combined, currentPage, perPage, units);

    if (result.totalLength === 0 && result.rows.length === 0) {
      return { data: [], pagination: calculatePagination(0, currentPage, perPage) };
    }

    return {
      data: result.rows,
      pagination: calculatePagination(result.totalLength, currentPage, perPage),
    };
  }

  function calculatePagination(
    totalItems: number,
    currentPage: number,
    perPage: number,
  ): Pagination {
    const pages = Math.max(1, Math.ceil(totalItems / perPage));
    const from = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
    const to = Math.min(currentPage * perPage, totalItems);

    return {
      items: totalItems,
      pages,
      per_page: perPage,
      current_page: currentPage,
      last_page: pages,
      first_page: 1,
      from,
      to,
    };
  }

  async function fetchRankingsData(
    currentPage: number,
    perPage: number,
    units: string = "lbs",
    federation?: string,
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    return queryRankings({ federation }, currentPage, perPage, normalizeUnits(units));
  }

  return {
    getRankings,
    getRank,
    getFilteredRankings,
    fetchRankingsData,
  };
}
