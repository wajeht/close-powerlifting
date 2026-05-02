import type { ScraperType } from "../../../context";
import { configuration } from "../../../configuration";
import type { RankingRow, RankingsApiResponse, ApiResponse, Pagination } from "../../../types";
import type {
  GetRankingsType,
  GetRankType,
  GetFilteredRankingsParamType,
  GetFilteredRankingsQueryType,
} from "./rankings.validation";

const { defaultPerPage } = configuration.pagination;

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

export function createRankingService(scraper: ScraperType) {
  async function fetchRankingsData(
    currentPage: number,
    perPage: number,
    units: string = "lbs",
    federation?: string,
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    const query = scraper.buildPaginationQuery(currentPage, perPage, units);
    const fedPath = federation ? `/${federation}` : "";
    const response = await scraper.fetchJson<RankingsApiResponse>(`/rankings${fedPath}?${query}`);

    return {
      rows: response.rows.map(transformRankingRow),
      totalLength: response.total_length,
    };
  }

  async function getRankings({
    current_page = 1,
    per_page = defaultPerPage,
    units = "lbs",
    federation,
  }: GetRankingsType): Promise<ApiResponse<RankingRow[]> & { pagination?: Pagination }> {
    const cacheKey = `rankings-${current_page}-${per_page}-${units}${federation ? `-${federation}` : ""}`;

    const result = await scraper.withCache<{ rows: RankingRow[]; totalLength: number }>(
      cacheKey,
      () => fetchRankingsData(current_page, per_page, units, federation),
    );

    if (!result.data) {
      return { data: null };
    }

    return {
      data: result.data.rows,
      pagination: scraper.calculatePagination(result.data.totalLength, current_page, per_page),
    };
  }

  async function getRank({ rank }: GetRankType): Promise<RankingRow | null> {
    const rankNum = parseInt(rank, 10);
    if (isNaN(rankNum) || rankNum < 1) {
      return null;
    }

    const perPage = defaultPerPage;
    const currentPage = Math.ceil(rankNum / perPage);
    const indexInPage = (rankNum - 1) % perPage;

    const result = await getRankings({
      current_page: currentPage,
      per_page: perPage,
    });

    if (!result.data || !result.data[indexInPage]) {
      return null;
    }

    return result.data[indexInPage];
  }

  function buildFilterPath(
    filters: GetFilteredRankingsParamType,
    options?: { federation?: string; age_class?: string },
  ): string {
    const parts: string[] = [];
    if (options?.federation) parts.push(options.federation);
    if (filters.equipment) parts.push(filters.equipment);
    if (filters.sex) parts.push(filters.sex);
    if (filters.weight_class) parts.push(filters.weight_class);
    if (options?.age_class) parts.push(options.age_class);
    if (filters.year) parts.push(filters.year);
    if (filters.event) parts.push(filters.event);
    if (filters.sort) parts.push(filters.sort);
    return parts.length > 0 ? `/${parts.join("/")}` : "";
  }

  async function fetchFilteredRankingsData(
    filters: GetFilteredRankingsParamType,
    currentPage: number,
    perPage: number,
    units: string = "lbs",
    federation?: string,
    age_class?: string,
  ): Promise<{ rows: RankingRow[]; totalLength: number }> {
    const filterPath = buildFilterPath(filters, { federation, age_class });
    const query = scraper.buildPaginationQuery(currentPage, perPage, units);
    const response = await scraper.fetchJson<RankingsApiResponse>(
      `/rankings${filterPath}?${query}`,
    );

    return {
      rows: response.rows.map(transformRankingRow),
      totalLength: response.total_length,
    };
  }

  async function getFilteredRankings(
    filters: GetFilteredRankingsParamType,
    query: GetFilteredRankingsQueryType,
  ): Promise<ApiResponse<RankingRow[]> & { pagination?: Pagination }> {
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const units = query.units ?? "lbs";
    const federation = query.federation;
    const age_class = query.age_class;

    const filterPath = buildFilterPath(filters, { federation, age_class });
    const cacheKey = `rankings${filterPath}-${currentPage}-${perPage}-${units}`;

    const result = await scraper.withCache<{ rows: RankingRow[]; totalLength: number }>(
      cacheKey,
      () => fetchFilteredRankingsData(filters, currentPage, perPage, units, federation, age_class),
    );

    if (!result.data) {
      return { data: null };
    }

    return {
      data: result.data.rows,
      pagination: scraper.calculatePagination(result.data.totalLength, currentPage, perPage),
    };
  }

  return {
    getRankings,
    getRank,
    getFilteredRankings,
    fetchRankingsData,
  };
}
