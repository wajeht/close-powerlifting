import type { Entry, Equipment, Event as PowerliftingEvent, Meet, PlaceStatus, Sex } from "./types";

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

export interface NormalizedRow {
  lifterUsername: string;
  lifterName: string;
  meetPath: string;
  meet: Meet;
  entry: Omit<Entry, "lifterId" | "meetId">;
}

const REGEX_DIACRITICS = /\p{Mn}/gu;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;
const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_PLACE_NUMERIC = /^\d+$/;

const VALID_EVENTS = new Set<PowerliftingEvent>(["SBD", "BD", "SD", "SB", "S", "B", "D"]);
const VALID_EQUIPMENT = new Set<Equipment>([
  "Raw",
  "Wraps",
  "Single-ply",
  "Multi-ply",
  "Unlimited",
  "Straps",
]);

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

export function nameToSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(REGEX_DIACRITICS, "")
    .toLowerCase()
    .replace(REGEX_SLUG_STRIP, "");
}

export function usernameFor(name: string, rowIdx: number): string {
  const slug = nameToSlug(name);
  return slug.length > 0 ? slug : `anon${rowIdx}`;
}

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
  const meetPath = `${nameToSlug(federation)}/${date}/${nameToSlug(meetName)}`;
  const place = splitPlace(row[cols.Place]);

  return {
    lifterUsername,
    lifterName: nameRaw,
    meetPath,
    meet: {
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
    },
    entry: {
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
    },
  };
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

function splitPlace(value: string | undefined): {
  rank: number | null;
  status: PlaceStatus | null;
} {
  const text = trimToNull(value);
  if (text == null) return { rank: null, status: null };
  if (REGEX_PLACE_NUMERIC.test(text)) return { rank: parseInt(text, 10), status: null };
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

function toEvent(value: string | undefined): PowerliftingEvent | null {
  const text = trimToNull(value);
  if (text == null) return null;
  return VALID_EVENTS.has(text as PowerliftingEvent) ? (text as PowerliftingEvent) : null;
}

function toEquipment(value: string | undefined): Equipment | null {
  const text = trimToNull(value);
  if (text == null) return null;
  return VALID_EQUIPMENT.has(text as Equipment) ? (text as Equipment) : null;
}
