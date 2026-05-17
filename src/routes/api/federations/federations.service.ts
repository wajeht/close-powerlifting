import type { Knex } from "knex";

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

interface MeetDbRow {
  federation: string | null;
  date: string;
  meet_name: string | null;
  meet_country: string | null;
  meet_state: string | null;
}

function buildLocation(country: string | null, state: string | null): string {
  if (country && state) return `${country}-${state}`;
  return country ?? "";
}

function toMeet(row: MeetDbRow): FederationMeet {
  return {
    fed: row.federation ?? "",
    date: row.date,
    competition: row.meet_name ?? "",
    location: buildLocation(row.meet_country, row.meet_state),
    federation: row.federation ?? "",
    meetname: row.meet_name ?? "",
  };
}

export function buildFederationStats(
  federation: string,
  meets: ReadonlyArray<FederationMeet>,
): FederationStats {
  const yearCounts = new Map<number, number>();

  for (const row of meets) {
    const match = row.date.match(REGEX_YEAR_PREFIX);
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

export function createFederationService(knex: Knex) {
  async function queryDistinctMeets(filter?: {
    federation?: string;
    year?: number;
  }): Promise<MeetDbRow[]> {
    let query = knex("meets")
      .join("federations", "federations.id", "meets.federation_id")
      .select<MeetDbRow[]>(
        knex.ref("federations.code").as("federation"),
        "meets.date",
        "meets.meet_name",
        "meets.meet_country",
        "meets.meet_state",
      );

    if (filter?.federation) {
      const slug = filter.federation.toLowerCase().replace(/[^a-z0-9]/g, "");
      query = query.where((qb) =>
        qb.where("federations.slug", slug).orWhere("federations.parent_slug", slug),
      );
    }
    if (filter?.year) {
      query = query.where("meets.date", "like", `${filter.year}-%`);
    }

    return (await query.orderBy("meets.date", "desc")) as MeetDbRow[];
  }

  async function getFederations({
    current_page = 1,
    per_page = defaultPerPage,
  }: GetFederationsType): Promise<ApiResponse<FederationMeet[]> & { pagination?: Pagination }> {
    const rows = await queryDistinctMeets();
    const meets = rows.map(toMeet);

    const startIndex = (current_page - 1) * per_page;
    const endIndex = startIndex + per_page;
    const paginatedData = meets.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      pagination: calculatePagination(meets.length, current_page, per_page),
    };
  }

  async function getFederation({
    federation,
    year,
  }: GetFederationsParamType & GetFederationsQueryType): Promise<ApiResponse<FederationMeet[]>> {
    const rows = await queryDistinctMeets({ federation, year });
    if (rows.length === 0) {
      return { data: null };
    }
    return { data: rows.map(toMeet) };
  }

  async function getFederationStats(federation: string): Promise<ApiResponse<FederationStats>> {
    const rows = await queryDistinctMeets({ federation });
    if (rows.length === 0) {
      return { data: buildFederationStats(federation, []) };
    }
    return { data: buildFederationStats(federation, rows.map(toMeet)) };
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

  return {
    getFederations,
    getFederation,
    getFederationStats,
  };
}
