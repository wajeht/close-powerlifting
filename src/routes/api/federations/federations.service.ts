import type { DataStoreType } from "../../../data/store";
import type { Pagination } from "../../../types";
import { buildPagination } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type { GetFederationsType, GetFederationMeetsQueryType } from "./federations.validation";

const { defaultPerPage } = configuration.pagination;

export interface FederationRow {
  slug: string;
  code: string;
  parent_slug: string | null;
  meet_count: number;
}

export interface FederationDetail extends FederationRow {
  meets: Array<{
    path: string;
    meet_name: string;
    date: string;
    country: string | null;
    state: string | null;
    town: string | null;
    sanctioned: boolean;
  }>;
}

export interface FederationStats {
  slug: string;
  code: string;
  parent_slug: string | null;
  total_meets: number;
  meets_by_year: Array<{ year: number; meet_count: number }>;
}

export function createFederationsService(store: DataStoreType) {
  function getFederations(query: GetFederationsType): {
    data: FederationRow[];
    pagination: Pagination;
  } {
    const data = store.get();
    const rows: FederationRow[] = data.federations.map((fed) => ({
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parentSlug,
      meet_count: fed.meetCount,
    }));
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(rows.length, currentPage, perPage);
    const start = (pagination.current_page - 1) * pagination.per_page;
    return { data: rows.slice(start, start + pagination.per_page), pagination };
  }

  function getFederation(
    slugInput: string,
    query: GetFederationMeetsQueryType,
  ): FederationDetail | null {
    const data = store.get();
    const slug = slugInput.toLowerCase();
    const fed = data.federations.find((f) => f.slug === slug);
    if (fed == null) return null;

    const meetIds = data.meetsByFederation.get(slug) ?? [];
    let meets = meetIds.map((id) => data.meets[id]!).sort((a, b) => b.date.localeCompare(a.date));
    if (query.year != null) {
      const prefix = `${query.year}-`;
      meets = meets.filter((m) => m.date.startsWith(prefix));
    }
    return {
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parentSlug,
      meet_count: meets.length,
      meets: meets.map((m) => ({
        path: m.path,
        meet_name: m.meetName,
        date: m.date,
        country: m.meetCountry,
        state: m.meetState,
        town: m.meetTown,
        sanctioned: m.sanctioned,
      })),
    };
  }

  function getFederationStats(slugInput: string): FederationStats | null {
    const data = store.get();
    const slug = slugInput.toLowerCase();
    const fed = data.federations.find((f) => f.slug === slug);
    if (fed == null) return null;

    const meetIds = data.meetsByFederation.get(slug) ?? [];
    const byYear = new Map<number, number>();
    for (const id of meetIds) {
      const year = parseInt(data.meets[id]!.date.slice(0, 4), 10);
      if (!Number.isFinite(year)) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
    }
    const stats = Array.from(byYear, ([year, meet_count]) => ({ year, meet_count })).sort(
      (a, b) => b.year - a.year,
    );
    return {
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parentSlug,
      total_meets: fed.meetCount,
      meets_by_year: stats,
    };
  }

  return { getFederations, getFederation, getFederationStats };
}
