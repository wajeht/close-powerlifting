import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import { type Pagination, buildPagination } from "../../../utils/helpers";
import { configuration } from "../../../configuration";
import type { GetFederationsType, GetFederationMeetsQueryType } from "./federations.schema";

const { defaultPerPage } = configuration.pagination;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;

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

interface CountRow {
  count: string | number;
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

interface YearCountRow {
  year: number;
  meet_count: string | number;
}

export function createFederationsService(store: DataStoreType) {
  async function getFederations(query: GetFederationsType): Promise<{
    data: FederationRow[];
    pagination: Pagination;
  }> {
    const { db } = store.get();
    const totalRow = await db<CountRow>("federations").count({ count: "*" }).first();
    const total = Number(totalRow?.count ?? 0);
    const currentPage = query.current_page ?? 1;
    const perPage = query.per_page ?? defaultPerPage;
    const pagination = buildPagination(total, currentPage, perPage);
    const rows = await db<FederationRow>("federations")
      .select("slug", "code", "parent_slug", "meet_count")
      .orderBy("meet_count", "desc")
      .limit(pagination.per_page)
      .offset(pagination.from > 0 ? pagination.from - 1 : 0);
    return { data: rows, pagination };
  }

  async function getFederation(
    slugInput: string,
    query: GetFederationMeetsQueryType,
  ): Promise<FederationDetail | null> {
    const { db } = store.get();
    const slug = toSlug(slugInput);
    const fed = await getFederationRow(db, slug);
    if (fed == null) return null;

    const meetQuery = db<MeetRow>("meets")
      .where("federation_slug", slug)
      .select("path", "meet_name", "date", "meet_country", "meet_state", "meet_town", "sanctioned")
      .orderBy("date", "desc");
    if (query.year != null) meetQuery.where("date", "like", `${query.year}-%`);
    const meets = await meetQuery;
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
        sanctioned: meet.sanctioned === 1,
      })),
    };
  }

  async function getFederationStats(slugInput: string): Promise<FederationStats | null> {
    const { db } = store.get();
    const slug = toSlug(slugInput);
    const fed = await getFederationRow(db, slug);
    if (fed == null) return null;

    const stats = await db.raw<YearCountRow[]>(
      `
        SELECT
          CAST(substr(date, 1, 4) AS INTEGER) AS year,
          COUNT(*) AS meet_count
        FROM meets
        WHERE federation_slug = ?
        GROUP BY substr(date, 1, 4)
        ORDER BY year DESC
      `,
      [slug],
    );

    return {
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parent_slug,
      total_meets: fed.meet_count,
      meets_by_year: stats.map((row) => ({
        year: Number(row.year),
        meet_count: Number(row.meet_count),
      })),
    };
  }

  return { getFederations, getFederation, getFederationStats };
}

async function getFederationRow(db: Knex, slug: string): Promise<FederationRow | null> {
  const row = await db<FederationRow>("federations")
    .where("slug", slug)
    .select("slug", "code", "parent_slug", "meet_count")
    .first();
  return row ?? null;
}

function toSlug(value: string): string {
  return value.toLowerCase().replace(REGEX_SLUG_STRIP, "");
}
