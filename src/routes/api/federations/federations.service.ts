import {
  fetchHtml,
  parseHtml,
  tableToJson,
  withCache,
  calculatePagination,
} from "../../../utils/scraper";
import { config } from "../../../config";
import type { Meet, ApiResponse, Pagination } from "../../../types";
import type {
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

const CACHE_TTL = 3600;
const { defaultPerPage } = config.pagination;

type FederationMeet = Meet;

async function fetchFederationsList(): Promise<FederationMeet[]> {
  const html = await fetchHtml("/mlist");
  const doc = parseHtml(html);
  const table = doc.querySelector("table");
  return tableToJson(table) as FederationMeet[];
}

export async function getFederations({
  current_page = 1,
  per_page = defaultPerPage,
  cache: useCache = true,
}: GetFederationsType): Promise<ApiResponse<FederationMeet[]> & { pagination?: Pagination }> {
  const cacheKey = `federations-list`;

  const result = await withCache<FederationMeet[]>(
    { key: cacheKey, ttlSeconds: CACHE_TTL },
    fetchFederationsList,
    useCache,
  );

  if (!result.data) {
    return result;
  }

  const allData = result.data;
  const startIndex = (current_page - 1) * per_page;
  const endIndex = startIndex + per_page;
  const paginatedData = allData.slice(startIndex, endIndex);

  return {
    data: paginatedData,
    cache: result.cache,
    pagination: calculatePagination(allData.length, current_page, per_page),
  };
}

async function fetchFederationMeets(federation: string, year?: number): Promise<FederationMeet[]> {
  const path = year ? `/mlist/${federation}/${year}` : `/mlist/${federation}`;
  const html = await fetchHtml(path);
  const doc = parseHtml(html);
  const table = doc.querySelector("table");
  return tableToJson(table) as FederationMeet[];
}

export async function getFederation({
  federation,
  year,
  cache: useCache = true,
}: GetFederationsParamType & GetFederationsQueryType): Promise<ApiResponse<FederationMeet[]>> {
  const cacheKey = year ? `federation-${federation}-${year}` : `federation-${federation}`;

  return withCache<FederationMeet[]>(
    { key: cacheKey, ttlSeconds: CACHE_TTL },
    () => fetchFederationMeets(federation, year),
    useCache,
  );
}
