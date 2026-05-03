import type { ScraperType } from "../../../context";
import { configuration } from "../../../configuration";
import type {
  Meet,
  ApiResponse,
  Pagination,
  FederationStats,
  FederationYearStat,
} from "../../../types";
import type {
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

const { defaultPerPage } = configuration.pagination;
const REGEX_YEAR_PREFIX = /^(\d{4})/;

type FederationMeet = Meet;

function fedField(row: FederationMeet, ...candidates: string[]): string {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) {
        const value = row[key];
        if (value != null) return value;
      }
    }
  }
  return "";
}

export function buildFederationStats(
  federation: string,
  meets: ReadonlyArray<FederationMeet>,
): FederationStats {
  const yearCounts = new Map<number, number>();

  for (const row of meets) {
    const dateField = fedField(row, "date");
    const match = dateField.match(REGEX_YEAR_PREFIX);
    if (!match) continue;
    const year = Number(match[1]);
    if (!Number.isFinite(year)) continue;
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  }

  const meetsByYear: FederationYearStat[] = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, meets: count }))
    .sort((a, b) => a.year - b.year);

  const earliestYear = meetsByYear.length > 0 ? meetsByYear[0]!.year : null;
  const latestYear = meetsByYear.length > 0 ? meetsByYear[meetsByYear.length - 1]!.year : null;

  return {
    federation,
    total_meets: meets.length,
    earliest_year: earliestYear,
    latest_year: latestYear,
    meets_by_year: meetsByYear,
  };
}

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

    const result = await scraper.withCache<FederationMeet[]>(cacheKey, fetchFederationsList);

    if (!result.data) {
      return result;
    }

    const allData = result.data;
    const startIndex = (current_page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedData = allData.slice(startIndex, endIndex);

    return {
      data: paginatedData,
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

    return scraper.withCache<FederationMeet[]>(cacheKey, () =>
      fetchFederationMeets(federation, year),
    );
  }

  async function getFederationStats(federation: string): Promise<ApiResponse<FederationStats>> {
    const cacheKey = `federation-${federation}-stats`;
    return scraper.withCache<FederationStats>(cacheKey, async () => {
      const meets = await fetchFederationMeets(federation);
      return buildFederationStats(federation, meets);
    });
  }

  function parseFederationCacheKey(key: string):
    | { kind: "list" }
    | { kind: "federation"; federation: string; year?: number }
    | {
        kind: "stats";
        federation: string;
      }
    | null {
    if (key === "federations-list") {
      return { kind: "list" };
    }

    if (!key.startsWith("federation-")) return null;
    const remainder = key.slice("federation-".length);

    if (remainder.endsWith("-stats")) {
      const federation = remainder.slice(0, -"-stats".length);
      if (!federation) return null;
      return { kind: "stats", federation };
    }

    const yearMatch = remainder.match(/^(.+)-(\d{4})$/);
    if (yearMatch && yearMatch[1] && yearMatch[2]) {
      return { kind: "federation", federation: yearMatch[1], year: parseInt(yearMatch[2], 10) };
    }

    if (!remainder) return null;
    return { kind: "federation", federation: remainder };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseFederationCacheKey(key);
    if (!parsed) return false;

    if (parsed.kind === "list") {
      await scraper.refreshCache<FederationMeet[]>(key, fetchFederationsList);
      return true;
    }

    if (parsed.kind === "federation") {
      await scraper.refreshCache<FederationMeet[]>(key, () =>
        fetchFederationMeets(parsed.federation, parsed.year),
      );
      return true;
    }

    if (parsed.kind === "stats") {
      await scraper.refreshCache<FederationStats>(key, async () => {
        const meets = await fetchFederationMeets(parsed.federation);
        return buildFederationStats(parsed.federation, meets);
      });
      return true;
    }

    return false;
  }

  return {
    parseFederationMeetsHtml,
    parseFederationCacheKey,
    getFederations,
    getFederation,
    getFederationStats,
    refreshCacheKey,
  };
}
