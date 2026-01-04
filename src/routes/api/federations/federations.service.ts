import type { ScraperType } from "../../../context";
import { configuration } from "../../../configuration";
import type { Meet, ApiResponse, Pagination } from "../../../types";
import type {
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

const CACHE_TTL = 90000;
const { defaultPerPage } = configuration.pagination;

type FederationMeet = Meet;

export function createFederationService(scraper: ScraperType) {
  function parseFederationMeetsHtml(doc: Document): FederationMeet[] {
    const table = doc.querySelector("table");
    return scraper.tableToJson(table) as FederationMeet[];
  }

  async function fetchFederationsList(): Promise<FederationMeet[]> {
    const html = await scraper.fetchHtml("/mlist");
    const doc = scraper.parseHtml(html);
    return parseFederationMeetsHtml(doc);
  }

  async function getFederations({
    current_page = 1,
    per_page = defaultPerPage,
  }: GetFederationsType): Promise<ApiResponse<FederationMeet[]> & { pagination?: Pagination }> {
    const cacheKey = `federations-list`;

    const result = await scraper.withCache<FederationMeet[]>(
      { key: cacheKey, ttlSeconds: CACHE_TTL },
      fetchFederationsList,
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
      pagination: scraper.calculatePagination(allData.length, current_page, per_page),
    };
  }

  async function fetchFederationMeets(
    federation: string,
    year?: number,
  ): Promise<FederationMeet[]> {
    const path = year ? `/mlist/${federation}/${year}` : `/mlist/${federation}`;
    const html = await scraper.fetchHtml(path);
    const doc = scraper.parseHtml(html);
    return parseFederationMeetsHtml(doc);
  }

  async function getFederation({
    federation,
    year,
  }: GetFederationsParamType & GetFederationsQueryType): Promise<ApiResponse<FederationMeet[]>> {
    const cacheKey = year ? `federation-${federation}-${year}` : `federation-${federation}`;

    return scraper.withCache<FederationMeet[]>({ key: cacheKey, ttlSeconds: CACHE_TTL }, () =>
      fetchFederationMeets(federation, year),
    );
  }

  return {
    parseFederationMeetsHtml,
    getFederations,
    getFederation,
  };
}
