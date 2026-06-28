// CSV normalization and derived-index helpers shared by the SQLite database
// builder and small fixture tests. Runtime data access lives in
// src/data/database.ts and uses the prebuilt SQLite snapshot directly.

import type { Entry, Equipment, Event as PowerliftingEvent, Meet, PlaceStatus, Sex } from "./types";

// ---------- CSV column schema (consumed by scripts/build-database.ts) ----------
//
// Verified against the actual bulk CSV header (May 2026): McCulloch,
// RuleSet, and MeetPath that earlier OPL drafts mentioned are NOT present.
// We compute the meet path slug client-side; ruleset defaults to null;
// McCulloch is dropped from the data model entirely.

export const REQUIRED_COLUMNS = [
  "Name",
  "Sex",
  "Event",
  "Equipment",
  "Age",
  "AgeClass",
  "BirthYearClass",
  "Division",
  "BodyweightKg",
  "WeightClassKg",
  "Squat1Kg",
  "Squat2Kg",
  "Squat3Kg",
  "Squat4Kg",
  "Bench1Kg",
  "Bench2Kg",
  "Bench3Kg",
  "Bench4Kg",
  "Deadlift1Kg",
  "Deadlift2Kg",
  "Deadlift3Kg",
  "Deadlift4Kg",
  "Best3SquatKg",
  "Best3BenchKg",
  "Best3DeadliftKg",
  "TotalKg",
  "Place",
  "Dots",
  "Wilks",
  "Glossbrenner",
  "Goodlift",
  "Tested",
  "Country",
  "State",
  "Federation",
  "ParentFederation",
  "Date",
  "MeetCountry",
  "MeetState",
  "MeetTown",
  "MeetName",
  "Sanctioned",
] as const;

export type ColumnName = (typeof REQUIRED_COLUMNS)[number];
export type ColumnIndex = Record<ColumnName, number>;

export function buildColumnIndex(header: string[]): ColumnIndex {
  const lookup: Partial<ColumnIndex> = {};
  for (const name of REQUIRED_COLUMNS) {
    const idx = header.indexOf(name);
    if (idx === -1) {
      throw new Error(`CSV header missing required column: ${name}`);
    }
    lookup[name] = idx;
  }
  return lookup as ColumnIndex;
}

const REGEX_DIACRITICS = /\p{Mn}/gu;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;
const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_PLACE_NUMERIC = /^\d+$/;

// Lifter slug. Mirrors OPL's Username::from_name (crates/opltypes/src/username.rs):
// strip diacritics, lowercase, alphanumeric-only. For CJK / Cyrillic-only
// names that have no ASCII transliteration, OPL falls back to a numeric id;
// we do the same — see `usernameFor` below where the row index is the seed.
export function nameToSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(REGEX_DIACRITICS, "")
    .toLowerCase()
    .replace(REGEX_SLUG_STRIP, "");
}

// Generates the username for a CSV name. Falls back to a deterministic
// "anon<rowIdx>" slug for names that produce an empty slug (CJK-only).
export function usernameFor(name: string, rowIdx: number): string {
  const slug = nameToSlug(name);
  if (slug.length > 0) return slug;
  return `anon${rowIdx}`;
}

function trimToNull(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: string | undefined): boolean {
  if (value == null) return false;
  return value.trim().toLowerCase() === "yes";
}

// OPL's `Place` column is overloaded: a number = finishing rank; a code
// (DQ / DD / NS / G) = non-finishing status. Split into our two columns.
function splitPlace(value: string | undefined): {
  rank: number | null;
  status: PlaceStatus | null;
} {
  const text = trimToNull(value);
  if (text == null) return { rank: null, status: null };
  if (REGEX_PLACE_NUMERIC.test(text)) {
    return { rank: parseInt(text, 10), status: null };
  }
  if (text === "G" || text === "DQ" || text === "DD" || text === "NS") {
    return { rank: null, status: text };
  }
  return { rank: null, status: null };
}

function toSex(value: string | undefined): Sex | null {
  const text = trimToNull(value);
  if (text === "M" || text === "F" || text === "Mx") return text;
  return null;
}

const VALID_EVENTS = new Set<PowerliftingEvent>(["SBD", "BD", "SD", "SB", "S", "B", "D"]);
function toEvent(value: string | undefined): PowerliftingEvent | null {
  const text = trimToNull(value);
  if (text == null) return null;
  return VALID_EVENTS.has(text as PowerliftingEvent) ? (text as PowerliftingEvent) : null;
}

const VALID_EQUIPMENT = new Set<Equipment>([
  "Raw",
  "Wraps",
  "Single-ply",
  "Multi-ply",
  "Unlimited",
  "Straps",
]);
function toEquipment(value: string | undefined): Equipment | null {
  const text = trimToNull(value);
  if (text == null) return null;
  return VALID_EQUIPMENT.has(text as Equipment) ? (text as Equipment) : null;
}

// Result of converting one CSV row. The build script uses this to dedupe
// lifters and meets (via lifterUsername and meetPath) before building the
// final Entry with its resolved FKs.
export interface NormalizedRow {
  lifterUsername: string;
  lifterName: string;
  meetPath: string;
  meet: Omit<Meet, "path"> & { path: string };
  // Entry without lifter_id / meet_id — the build script assigns those
  // once it has materialised the lifter and meet entities.
  entry: Omit<Entry, "lifterId" | "meetId">;
}

// Converts one CSV row (array of column strings) into normalized values.
// Returns null for unusable rows (missing required category fields, bad
// date). Lifter row index is used as the seed for non-ASCII username fallback.
export function normalizeRow(
  row: string[],
  cols: ColumnIndex,
  rowIdx: number,
): NormalizedRow | null {
  const nameRaw = trimToNull(row[cols.Name]);
  if (nameRaw == null) return null;

  const event = toEvent(row[cols.Event]);
  if (event == null) return null;

  const equipment = toEquipment(row[cols.Equipment]);
  if (equipment == null) return null;

  const date = trimToNull(row[cols.Date]);
  if (date == null || !REGEX_ISO_DATE.test(date)) return null;

  const federation = trimToNull(row[cols.Federation]);
  if (federation == null) return null;

  const meetName = trimToNull(row[cols.MeetName]);
  if (meetName == null) return null;

  const lifterUsername = usernameFor(nameRaw, rowIdx);

  // The CSV doesn't ship a MeetPath column anymore, so we synthesise the
  // canonical URL slug ourselves: lower(federation) / date / slug(meetName).
  const meetPath = `${nameToSlug(federation)}/${date}/${nameToSlug(meetName)}`;

  const place = splitPlace(row[cols.Place]);

  const meet: Meet = {
    path: meetPath,
    federation,
    parentFederation: trimToNull(row[cols.ParentFederation]),
    date,
    meetName,
    meetCountry: trimToNull(row[cols.MeetCountry]),
    meetState: trimToNull(row[cols.MeetState]),
    meetTown: trimToNull(row[cols.MeetTown]),
    ruleset: null,
    sanctioned: toBoolean(row[cols.Sanctioned]),
  };

  const entry: Omit<Entry, "lifterId" | "meetId"> = {
    sex: toSex(row[cols.Sex]),
    age: toNumber(row[cols.Age]),
    ageClass: trimToNull(row[cols.AgeClass]),
    division: trimToNull(row[cols.Division]),
    lifterCountry: trimToNull(row[cols.Country]),
    lifterState: trimToNull(row[cols.State]),
    event,
    equipment,
    tested: toBoolean(row[cols.Tested]),
    bodyweightKg: toNumber(row[cols.BodyweightKg]),
    weightClassKg: toNumber(row[cols.WeightClassKg]),
    squat1Kg: toNumber(row[cols.Squat1Kg]),
    squat2Kg: toNumber(row[cols.Squat2Kg]),
    squat3Kg: toNumber(row[cols.Squat3Kg]),
    squat4Kg: toNumber(row[cols.Squat4Kg]),
    bench1Kg: toNumber(row[cols.Bench1Kg]),
    bench2Kg: toNumber(row[cols.Bench2Kg]),
    bench3Kg: toNumber(row[cols.Bench3Kg]),
    bench4Kg: toNumber(row[cols.Bench4Kg]),
    deadlift1Kg: toNumber(row[cols.Deadlift1Kg]),
    deadlift2Kg: toNumber(row[cols.Deadlift2Kg]),
    deadlift3Kg: toNumber(row[cols.Deadlift3Kg]),
    deadlift4Kg: toNumber(row[cols.Deadlift4Kg]),
    best3SquatKg: toNumber(row[cols.Best3SquatKg]),
    best3BenchKg: toNumber(row[cols.Best3BenchKg]),
    best3DeadliftKg: toNumber(row[cols.Best3DeadliftKg]),
    totalKg: toNumber(row[cols.TotalKg]),
    placeRank: place.rank,
    placeStatus: place.status,
    dots: toNumber(row[cols.Dots]),
    wilks: toNumber(row[cols.Wilks]),
    glossbrenner: toNumber(row[cols.Glossbrenner]),
    goodlift: toNumber(row[cols.Goodlift]),
  };

  return { lifterUsername, lifterName: nameRaw, meetPath, meet, entry };
}
