import type { Knex } from "knex";

import type { ScraperType } from "../../../context";
import type {
  MeetData,
  MeetResult,
  ApiResponse,
  MeetHighlights,
  MeetHighlightLifter,
} from "../../../types";
import { nameToSlug } from "../../../utils/ingest";
import type { GetMeetParamType, GetMeetHighlightsParamType } from "./meets.validation";

const HIGHLIGHTS_TOP_N = 3;
const REGEX_MEET_SORT_SUFFIX = /-(by-[a-z0-9-]+)$/;
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

export function createMeetService(knex: Knex, _scraper: ScraperType) {
  async function fetchMeetData(
    meet: string,
    sort?: string,
    units: string = "lbs",
  ): Promise<MeetData | null> {
    const parsed = parseMeetPath(meet);
    if (!parsed) return null;

    const normalizedUnits: "kg" | "lbs" = units === "kg" ? "kg" : "lbs";

    const rows = (await knex("lifts")
      .select<MeetLiftRow[]>(
        "name",
        "sex",
        "age",
        "equipment",
        "weight_class_kg",
        "bodyweight_kg",
        "best3_squat_kg",
        "best3_bench_kg",
        "best3_deadlift_kg",
        "total_kg",
        "dots",
        "wilks",
        "glossbrenner",
        "goodlift",
        "division",
        "meet_name",
        "meet_country",
        "meet_state",
      )
      .where({ date: parsed.date })
      .whereRaw("UPPER(federation) = ?", [parsed.federation.toUpperCase()])) as MeetLiftRow[];

    const matching = rows.filter(
      (row) => row.meet_name != null && nameToSlug(row.meet_name) === parsed.slug,
    );
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

  function parseMeetCacheKey(
    key: string,
  ): { path: string; sort?: string; units?: string; isHighlights: boolean } | null {
    if (!key.startsWith("meet-")) return null;
    let remainder = key.slice("meet-".length);

    let units: string | undefined;
    if (remainder.endsWith("-kg")) {
      units = "kg";
      remainder = remainder.slice(0, -"-kg".length);
    } else if (remainder.endsWith("-lbs")) {
      units = "lbs";
      remainder = remainder.slice(0, -"-lbs".length);
    }

    let isHighlights = false;
    if (remainder.endsWith("-highlights")) {
      isHighlights = true;
      remainder = remainder.slice(0, -"-highlights".length);
    }

    let sort: string | undefined;
    const sortMatch = remainder.match(REGEX_MEET_SORT_SUFFIX);
    if (sortMatch) {
      sort = sortMatch[1];
      remainder = remainder.slice(0, -sortMatch[0].length);
    }

    if (!remainder) return null;
    return { path: remainder, sort, units, isHighlights };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseMeetCacheKey(key);
    if (!parsed) return false;
    // Meets now served from lifts table; legacy cache keys are claimed
    // without re-scraping.
    return true;
  }

  return {
    parseMeetCacheKey,
    getMeet,
    getMeetHighlights,
    refreshCacheKey,
  };
}
