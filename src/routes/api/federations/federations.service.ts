import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DataStoreType } from "../../../data/store";
import { type Pagination, buildPagination } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type { GetFederationsType, GetFederationMeetsQueryType } from "./federations.schema";

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

interface MeetRow {
  path: string;
  meet_name: string;
  date: string;
  meet_country: string | null;
  meet_state: string | null;
  meet_town: string | null;
  sanctioned: number;
}

export function createFederationsService(store: DataStoreType) {
  function getFederations(query: GetFederationsType): {
    data: FederationRow[];
    pagination: Pagination;
  } {
    const db = store.get();
    const total = scalarCount(db, "SELECT COUNT(*) AS count FROM federations");
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const rows = db
      .prepare(
        `
        SELECT slug, code, parent_slug, meet_count
        FROM federations
        ORDER BY meet_count DESC, slug
        LIMIT ? OFFSET ?
      `,
      )
      .all(pagination.per_page, offset(pagination)) as unknown as FederationRow[];
    return { data: rows, pagination };
  }

  function getFederation(
    slugInput: string,
    query: GetFederationMeetsQueryType,
  ): FederationDetail | null {
    const db = store.get();
    const slug = slugInput.toLowerCase();
    const fed = lookupFederation(db, slug);
    if (fed == null) return null;

    const params: SQLInputValue[] = [slug];
    const clauses = ["federation_slug = ?"];
    if (query.year != null) {
      clauses.push("date LIKE ?");
      params.push(`${query.year}-%`);
    }
    const meets = db
      .prepare(
        `
        SELECT path, meet_name, date, meet_country, meet_state, meet_town, sanctioned
        FROM meets
        WHERE ${clauses.join(" AND ")}
        ORDER BY date DESC
      `,
      )
      .all(...params) as unknown as MeetRow[];

    return {
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parent_slug,
      meet_count: meets.length,
      meets: meets.map((meet) => ({
        path: meet.path,
        meet_name: meet.meet_name,
        date: meet.date,
        country: meet.meet_country,
        state: meet.meet_state,
        town: meet.meet_town,
        sanctioned: Boolean(meet.sanctioned),
      })),
    };
  }

  function getFederationStats(slugInput: string): FederationStats | null {
    const db = store.get();
    const slug = slugInput.toLowerCase();
    const fed = lookupFederation(db, slug);
    if (fed == null) return null;

    const rows = db
      .prepare(
        `
        SELECT CAST(substr(date, 1, 4) AS INTEGER) AS year, COUNT(*) AS meet_count
        FROM meets
        WHERE federation_slug = ?
        GROUP BY year
        ORDER BY year DESC
      `,
      )
      .all(slug) as Array<{ year: number; meet_count: number }>;
    return {
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parent_slug,
      total_meets: fed.meet_count,
      meets_by_year: rows,
    };
  }

  return { getFederations, getFederation, getFederationStats };
}

function lookupFederation(db: DatabaseSync, slug: string): FederationRow | null {
  const row = db
    .prepare("SELECT slug, code, parent_slug, meet_count FROM federations WHERE slug = ?")
    .get(slug) as FederationRow | undefined;
  return row ?? null;
}

function scalarCount(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return row?.count ?? 0;
}

function offset(pagination: Pagination): number {
  return (pagination.current_page - 1) * pagination.per_page;
}
