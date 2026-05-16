import type { Knex } from "knex";

import type { ScraperType } from "../../../context";
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
const REGEX_RANKINGS_CACHE_KEY =
  /^(rankings(?:\/[^?\s]*)?)-(\d+)-(\d+)-(lbs|kg)(?:-([a-z][a-z0-9-]*))?$/;
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
    if (mapped) query = query.whereIn("equipment", mapped);
  }

  if (filters.sex) {
    const mapped = SEX_MAP[filters.sex];
    if (mapped) query = query.where("sex", mapped);
  }

  if (filters.event) {
    const mapped = EVENT_MAP[filters.event];
    if (mapped) query = query.where("event", mapped);
  }

  if (filters.weightClass) {
    const numeric = parseFloat(filters.weightClass);
    if (Number.isFinite(numeric)) query = query.where("weight_class_kg", numeric);
  }

  if (filters.year) {
    query = query.where("date", "like", `${filters.year}-%`);
  }

  if (filters.ageClass) {
    query = query.where("age_class", filters.ageClass);
  }

  if (filters.federation) {
    const fed = filters.federation.toUpperCase();
    query = query.where((qb) =>
      qb.whereRaw("UPPER(federation) = ?", [fed]).orWhereRaw("UPPER(parent_federation) = ?", [fed]),
    );
  }

  return query;
}

export interface LiftRow {
  name: string;
  name_slug: string;
  sex: string | null;
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
  const meetCode = row.meet_name ? `${(row.federation ?? "").toLowerCase()}/${row.date}` : "";

  return {
    id: 0,
    rank,
    full_name: row.name,
    username,
    user_profile: `/api/users/${username}`,
    instagram: "",
    instagram_url: "",
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

export function transformRankingRow(row: (string | number)[]): RankingRow {
  const username = String(row[3] || "");
  const meetCode = String(row[12] || "");
  const instagram = String(row[4] || "");

  return {
    id: Number(row[0]) || 0,
    rank: Number(row[1]) || 0,
    full_name: String(row[2] || ""),
    username,
    user_profile: `/api/users/${username}`,
    instagram,
    instagram_url: instagram ? `https://www.instagram.com/${instagram}` : "",
    username_color: String(row[5] || ""),
    country: String(row[6] || ""),
    location: String(row[7] || ""),
    fed: String(row[8] || ""),
    federation_url: meetCode ? `/api/federations/${meetCode.split("/")[0]}` : "",
    date: String(row[9] || ""),
    country_two: String(row[10] || ""),
    state: String(row[11] || ""),
    meet_code: meetCode,
    meet_url: meetCode ? `/api/meets/${meetCode}` : "",
    sex: String(row[13] || ""),
    equip: String(row[14] || ""),
    age: parseInt(String(row[15]), 10) || 0,
    open: String(row[16] || ""),
    body_weight: parseFloat(String(row[17])) || 0,
    weight_class: parseFloat(String(row[18])) || 0,
    squat: parseFloat(String(row[19])) || 0,
    bench: parseFloat(String(row[20])) || 0,
    deadlift: parseFloat(String(row[21])) || 0,
    total: parseFloat(String(row[22])) || 0,
    dots: parseFloat(String(row[23])) || 0,
  };
}

function normalizeUnits(units: string | undefined): "kg" | "lbs" {
  return units === "kg" ? "kg" : "lbs";
}

export function createRankingService(knex: Knex, _scraper: ScraperType) {
  async function queryRankings(
    filters: RankingsFilters,
    currentPage: number,
    perPage: number,
    units: "kg" | "lbs",
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    const sortColumn = SORT_COLUMN[filters.sort ?? "by-dots"] ?? "dots";
    const offset = (currentPage - 1) * perPage;

    const filteredBase = applyFilters(knex("lifts"), filters).whereNotNull(sortColumn);

    const totalResult = await filteredBase
      .clone()
      .countDistinct({ count: "name_slug" })
      .first<{ count: number | string }>();
    const totalLength = Number(totalResult?.count ?? 0);

    if (totalLength === 0) {
      return { rows: [], totalLength: 0 };
    }

    const innerQuery = applyFilters(
      knex("lifts").select(
        "name",
        "name_slug",
        "sex",
        "event",
        "equipment",
        "age",
        "bodyweight_kg",
        "weight_class_kg",
        "best3_squat_kg",
        "best3_bench_kg",
        "best3_deadlift_kg",
        "total_kg",
        "dots",
        "wilks",
        "glossbrenner",
        "goodlift",
        "federation",
        "parent_federation",
        "date",
        "meet_country",
        "meet_state",
        "meet_name",
        knex.raw(`ROW_NUMBER() OVER (PARTITION BY name_slug ORDER BY ${sortColumn} DESC) AS rn`),
      ),
      filters,
    ).whereNotNull(sortColumn);

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

  function parseRankingsCacheKey(key: string): {
    filterPath: string;
    currentPage: number;
    perPage: number;
    units: string;
    federation?: string;
  } | null {
    if (!key.startsWith("rankings")) return null;

    const match = key.match(REGEX_RANKINGS_CACHE_KEY);
    if (!match) return null;

    const prefix = match[1] ?? "rankings";
    const pageStr = match[2] ?? "";
    const perPageStr = match[3] ?? "";
    const units = match[4] ?? "lbs";
    const federation = match[5];

    const currentPage = parseInt(pageStr, 10);
    const perPage = parseInt(perPageStr, 10);

    if (isNaN(currentPage) || isNaN(perPage)) return null;

    const filterPath = prefix === "rankings" ? "" : prefix.slice("rankings".length);

    return { filterPath, currentPage, perPage, units, federation };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseRankingsCacheKey(key);
    if (!parsed) return false;
    // Rankings now served from lifts table; legacy cache keys cannot be
    // refreshed. Claim the key so the cron does not warn.
    return true;
  }

  return {
    getRankings,
    getRank,
    getFilteredRankings,
    fetchRankingsData,
    parseRankingsCacheKey,
    refreshCacheKey,
  };
}
