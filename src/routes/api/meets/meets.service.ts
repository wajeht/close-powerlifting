import type { Knex } from "knex";

import { configuration } from "../../../configuration";
import type {
  MeetData,
  MeetResult,
  ApiResponse,
  MeetHighlights,
  MeetHighlightLifter,
  Pagination,
} from "../../../types";
import { buildPagination } from "../../../utils/helpers";
import { nameToSlug } from "../../../utils/ingest";
import type {
  GetMeetParamType,
  GetMeetHighlightsParamType,
  ListMeetsQueryType,
} from "./meets.validation";

const { defaultPerPage } = configuration.pagination;

export interface MeetListEntry {
  federation: string;
  date: string;
  slug: string;
  name: string;
  country: string;
  state: string;
  sanctioned: boolean;
  lifter_count: number;
  url: string;
}

const HIGHLIGHTS_TOP_N = 3;
const KG_TO_LBS = 2.20462;

const SORT_COLUMN: Record<string, "dots" | "wilks" | "glossbrenner" | "goodlift" | "total_kg"> = {
  "by-dots": "dots",
  "by-wilks": "wilks",
  "by-wilks2020": "wilks",
  "by-glossbrenner": "glossbrenner",
  "by-goodlift": "goodlift",
  "by-ipf-points": "goodlift",
  "by-mcculloch": "dots",
  "by-total": "total_kg",
  "by-ah": "dots",
  "by-nasa": "dots",
  "by-reshel": "dots",
  "by-schwartz-malone": "dots",
};

interface MeetLiftRow {
  name: string;
  sex: string | null;
  age: number | null;
  equipment: string | null;
  weight_class_kg: number | null;
  bodyweight_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  division: string | null;
  meet_name: string | null;
  meet_country: string | null;
  meet_state: string | null;
}

function convertKg(value: number | null, units: "kg" | "lbs"): string {
  if (value == null) return "";
  const converted = units === "lbs" ? value * KG_TO_LBS : value;
  if (Number.isInteger(converted)) return String(converted);
  return converted.toFixed(2).replace(/\.?0+$/, "");
}

function buildLocation(country: string | null, state: string | null): string {
  if (country && state) return `${country}-${state}`;
  return country ?? "";
}

function toMeetResult(row: MeetLiftRow, rank: number, units: "kg" | "lbs"): MeetResult {
  return {
    rank: String(rank),
    lifter: row.name,
    sex: row.sex ?? "",
    age: row.age == null ? "" : String(Math.floor(row.age)),
    equip: row.equipment ?? "",
    class: row.weight_class_kg == null ? "" : convertKg(row.weight_class_kg, units),
    weight: convertKg(row.bodyweight_kg, units),
    squat: convertKg(row.best3_squat_kg, units),
    bench: convertKg(row.best3_bench_kg, units),
    deadlift: convertKg(row.best3_deadlift_kg, units),
    total: convertKg(row.total_kg, units),
    dots: row.dots == null ? "" : String(row.dots),
  };
}

function meetField(row: MeetResult, ...candidates: string[]): string {
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

function toLifter(row: MeetResult): MeetHighlightLifter {
  return {
    place: meetField(row, "rank", "place"),
    name: meetField(row, "lifter", "name"),
    sex: meetField(row, "sex"),
    weight_class: meetField(row, "class", "weight_class"),
    bodyweight: meetField(row, "weight", "bodyweight"),
    squat: meetField(row, "squat"),
    bench: meetField(row, "bench"),
    deadlift: meetField(row, "deadlift"),
    total: meetField(row, "total"),
    dots: meetField(row, "dots"),
  };
}

export function buildMeetHighlights(meet: MeetData): MeetHighlights {
  const lifters = meet.results;

  const byDots = [...lifters].sort(
    (a, b) => parseFloat(meetField(b, "dots") || "0") - parseFloat(meetField(a, "dots") || "0"),
  );
  const byTotal = [...lifters].sort(
    (a, b) => parseFloat(meetField(b, "total") || "0") - parseFloat(meetField(a, "total") || "0"),
  );

  const weightClasses = new Set<string>();
  for (const row of lifters) {
    const wc = meetField(row, "class", "weight_class");
    if (wc) weightClasses.add(wc);
  }

  return {
    title: meet.title,
    date: meet.date,
    location: meet.location,
    total_lifters: lifters.length,
    weight_classes_contested: [...weightClasses].sort(),
    top_by_dots: byDots.slice(0, HIGHLIGHTS_TOP_N).map(toLifter),
    top_by_total: byTotal.slice(0, HIGHLIGHTS_TOP_N).map(toLifter),
  };
}

interface ParsedMeetPath {
  federation: string;
  date: string;
  slug: string;
}

function parseMeetPath(meet: string): ParsedMeetPath | null {
  const parts = meet.split("/");
  if (parts.length < 3) return null;
  const [federation, date, ...slugParts] = parts;
  if (!federation || !date || slugParts.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { federation, date, slug: slugParts.join("/") };
}

export function createMeetService(knex: Knex) {
  // Cross-federation meet index. Filterable by federation, date range, location
  // and free-text on the meet name. `lifter_count` is the per-meet roll-up of
  // distinct lifters at that meet — useful for ranking meets by size.
  async function listMeets(
    query: ListMeetsQueryType,
  ): Promise<{ data: MeetListEntry[]; pagination: Pagination }> {
    // Express 5's req.query is a fresh getter on every access, so the zod
    // transform in apiValidationMiddleware does not always stick. Coerce
    // here so downstream pagination output is consistently numeric.
    const currentPage = Number(query.current_page ?? 1);
    const perPage = Number(query.per_page ?? defaultPerPage);
    const sort = query.sort ?? "date-desc";

    function applyFilters(builder: Knex.QueryBuilder): Knex.QueryBuilder {
      let filtered = builder;
      if (query.federation != null) {
        const slug = nameToSlug(query.federation);
        filtered = filtered.where((qb) =>
          qb.where("federations.slug", slug).orWhere("federations.parent_slug", slug),
        );
      }
      if (query.from != null) filtered = filtered.where("meets.date", ">=", query.from);
      if (query.to != null) filtered = filtered.where("meets.date", "<=", query.to);
      if (query.country != null) filtered = filtered.where("meets.meet_country", query.country);
      if (query.state != null) filtered = filtered.where("meets.meet_state", query.state);
      if (query.search != null) {
        filtered = filtered.where("meets.meet_name", "like", `%${query.search}%`);
      }
      return filtered;
    }

    const countRow = await applyFilters(
      knex("meets").join("federations", "federations.id", "meets.federation_id"),
    )
      .count<{ total: number | string }[]>({ total: "meets.id" })
      .first();
    const total = Number(countRow?.total ?? 0);

    const pagination = buildPagination(total, currentPage, perPage);
    const offset = (pagination.current_page - 1) * perPage;

    interface ListRow {
      federation_code: string;
      federation_slug: string;
      date: string;
      meet_slug: string;
      meet_name: string;
      meet_country: string | null;
      meet_state: string | null;
      sanctioned: number;
      lifter_count: number | string;
    }

    const rows = (await applyFilters(
      knex("meets")
        .join("federations", "federations.id", "meets.federation_id")
        .leftJoin("lifts", "lifts.meet_id", "meets.id")
        .select<ListRow[]>(
          knex.ref("federations.code").as("federation_code"),
          knex.ref("federations.slug").as("federation_slug"),
          "meets.date",
          "meets.meet_slug",
          "meets.meet_name",
          "meets.meet_country",
          "meets.meet_state",
          "meets.sanctioned",
        )
        .countDistinct<ListRow[]>({ lifter_count: "lifts.lifter_id" })
        .groupBy("meets.id"),
    )
      .modify((qb) => {
        if (sort === "by-lifters") qb.orderBy("lifter_count", "desc").orderBy("meets.date", "desc");
        else if (sort === "date-asc") qb.orderBy("meets.date", "asc");
        else qb.orderBy("meets.date", "desc");
      })
      .limit(perPage)
      .offset(offset)) as ListRow[];

    const data: MeetListEntry[] = rows.map((row) => ({
      federation: row.federation_code,
      date: row.date,
      slug: row.meet_slug,
      name: row.meet_name,
      country: row.meet_country ?? "",
      state: row.meet_state ?? "",
      sanctioned: Boolean(row.sanctioned),
      lifter_count: Number(row.lifter_count),
      url: `/api/meets/${row.federation_slug}/${row.date}/${row.meet_slug}`,
    }));

    return { data, pagination };
  }

  async function fetchMeetData(
    meet: string,
    sort?: string,
    units: string = "lbs",
  ): Promise<MeetData | null> {
    const parsed = parseMeetPath(meet);
    if (!parsed) return null;

    const normalizedUnits: "kg" | "lbs" = units === "kg" ? "kg" : "lbs";

    const federationSlug = nameToSlug(parsed.federation);
    const matching = (await knex("lifts")
      .join("lifters", "lifters.id", "lifts.lifter_id")
      .join("meets", "meets.id", "lifts.meet_id")
      .join("federations", "federations.id", "meets.federation_id")
      .select<MeetLiftRow[]>(
        knex.ref("lifters.name").as("name"),
        knex.ref("lifters.sex").as("sex"),
        "lifts.age",
        "lifts.equipment",
        "lifts.weight_class_kg",
        "lifts.bodyweight_kg",
        "lifts.best3_squat_kg",
        "lifts.best3_bench_kg",
        "lifts.best3_deadlift_kg",
        "lifts.total_kg",
        "lifts.dots",
        "lifts.wilks",
        "lifts.glossbrenner",
        "lifts.goodlift",
        "lifts.division",
        "meets.meet_name",
        "meets.meet_country",
        "meets.meet_state",
      )
      .where("federations.slug", federationSlug)
      .where("meets.date", parsed.date)
      .where("meets.meet_slug", parsed.slug)) as MeetLiftRow[];

    if (matching.length === 0) return null;

    const first = matching[0]!;
    const sortColumn = sort ? SORT_COLUMN[sort] : "dots";
    const effectiveSort: keyof MeetLiftRow = sortColumn ?? "dots";

    const sorted = [...matching].sort((a, b) => {
      const av = (a[effectiveSort] as number | null) ?? 0;
      const bv = (b[effectiveSort] as number | null) ?? 0;
      return bv - av;
    });

    const results = sorted.map((row, idx) => toMeetResult(row, idx + 1, normalizedUnits));

    return {
      title: first.meet_name ?? "",
      date: parsed.date,
      location: buildLocation(first.meet_country, first.meet_state),
      results,
    };
  }

  async function getMeet(
    { meet }: GetMeetParamType,
    sort?: string,
    units?: string,
  ): Promise<ApiResponse<MeetData>> {
    const data = await fetchMeetData(meet, sort, units);
    return { data };
  }

  async function getMeetHighlights(
    { meet }: GetMeetHighlightsParamType,
    units?: string,
  ): Promise<ApiResponse<MeetHighlights>> {
    const data = await fetchMeetData(meet, undefined, units);
    if (!data) return { data: null };
    return { data: buildMeetHighlights(data) };
  }

  return {
    listMeets,
    getMeet,
    getMeetHighlights,
  };
}
