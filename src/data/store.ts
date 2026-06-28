// CSV normalization and derived-index helpers shared by the SQLite database
// builder and small fixture tests. Runtime data access lives in
// src/data/database.ts and uses the prebuilt SQLite snapshot directly.

import type {
  Entry,
  Equipment,
  EquipmentGroup,
  Event as PowerliftingEvent,
  FederationSummary,
  Meet,
  MetricInt32Arrays,
  MetricUint32Arrays,
  PlaceStatus,
  RankMetric,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "./types";

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

// ---------- Index builders (used by the database builder and fixture tests) ----------

const METRIC_FIELD: Record<RankMetric, keyof Entry> = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "totalKg",
  squat: "best3SquatKg",
  bench: "best3BenchKg",
  deadlift: "best3DeadliftKg",
};

export const RANK_METRICS: ReadonlyArray<RankMetric> = [
  "dots",
  "wilks",
  "glossbrenner",
  "goodlift",
  "total",
  "squat",
  "bench",
  "deadlift",
];

export function buildEntriesByLifter(entries: Entry[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const lifterId = entries[i]!.lifterId;
    const list = map.get(lifterId);
    if (list == null) map.set(lifterId, [i]);
    else list.push(i);
  }
  return map;
}

export function buildEntriesByMeet(entries: Entry[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const meetId = entries[i]!.meetId;
    const list = map.get(meetId);
    if (list == null) map.set(meetId, [i]);
    else list.push(i);
  }
  return map;
}

// For each metric, the entry index of each lifter's best result on that
// metric. -1 = no eligible entry.
export function buildBestEntryByLifter(
  entries: Entry[],
  lifterCount: number,
  entriesByLifter: Map<number, number[]>,
): MetricInt32Arrays {
  const result = {} as MetricInt32Arrays;
  for (const metric of RANK_METRICS) {
    const field = METRIC_FIELD[metric];
    const out = new Int32Array(lifterCount).fill(-1);
    for (const [lifterId, entryIds] of entriesByLifter) {
      let bestIdx = -1;
      let bestVal = -Infinity;
      for (const entryId of entryIds) {
        const value = entries[entryId]![field] as number | null;
        if (value == null) continue;
        if (value > bestVal) {
          bestVal = value;
          bestIdx = entryId;
        }
      }
      out[lifterId] = bestIdx;
    }
    result[metric] = out;
  }
  return result;
}

// Lifter ids sorted DESC by their best value on each metric. Lifters with
// no eligible entry on a metric are excluded from that metric's index.
export function buildRankByMetric(
  entries: Entry[],
  lifterCount: number,
  bestEntryByLifter: MetricInt32Arrays,
): MetricUint32Arrays {
  const result = {} as MetricUint32Arrays;
  for (const metric of RANK_METRICS) {
    const field = METRIC_FIELD[metric];
    const bestForMetric = bestEntryByLifter[metric];

    const eligible: number[] = [];
    for (let lifterId = 0; lifterId < lifterCount; lifterId++) {
      if (bestForMetric[lifterId]! >= 0) eligible.push(lifterId);
    }

    eligible.sort((a, b) => {
      const ea = entries[bestForMetric[a]!]![field] as number | null;
      const eb = entries[bestForMetric[b]!]![field] as number | null;
      const av = ea ?? -Infinity;
      const bv = eb ?? -Infinity;
      return bv - av;
    });

    result[metric] = Uint32Array.from(eligible);
  }
  return result;
}

interface CategoryConfig {
  key: RecordCategory;
  liftField: keyof Pick<Entry, "best3SquatKg" | "best3BenchKg" | "best3DeadliftKg" | "totalKg">;
  events: ReadonlyArray<Entry["event"]>;
}

const CATEGORIES: ReadonlyArray<CategoryConfig> = [
  { key: "squat_full_power", liftField: "best3SquatKg", events: ["SBD"] },
  { key: "squat_all_events", liftField: "best3SquatKg", events: ["SBD", "S", "SB", "SD"] },
  { key: "bench_full_power", liftField: "best3BenchKg", events: ["SBD"] },
  { key: "bench_all_events", liftField: "best3BenchKg", events: ["SBD", "B", "SB", "BD"] },
  { key: "deadlift_full_power", liftField: "best3DeadliftKg", events: ["SBD"] },
  { key: "deadlift_all_events", liftField: "best3DeadliftKg", events: ["SBD", "D", "SD", "BD"] },
  { key: "total", liftField: "totalKg", events: ["SBD"] },
];

interface EquipmentGroupConfig {
  name: EquipmentGroup;
  matches: (entry: Entry) => boolean;
}

const EQUIPMENT_GROUPS: ReadonlyArray<EquipmentGroupConfig> = [
  { name: "raw", matches: (e) => e.equipment === "Raw" },
  { name: "wraps", matches: (e) => e.equipment === "Wraps" },
  { name: "single", matches: (e) => e.equipment === "Single-ply" },
  { name: "multi", matches: (e) => e.equipment === "Multi-ply" },
  { name: "unlimited", matches: (e) => e.equipment === "Unlimited" },
  { name: "all-tested", matches: (e) => e.tested === true },
];

const SEXES: ReadonlyArray<Sex> = ["M", "F"];
const TOP_N_PER_CLASS = 3;

// Top-3 records leaderboard: 7 categories × 6 equipment groups × 2 sexes
// = 84 buckets; each bucket is grouped by weight class with top-3 per class.
export function buildRecords(entries: Entry[]): WeightClassRecord[] {
  const out: WeightClassRecord[] = [];

  for (const category of CATEGORIES) {
    const eventSet = new Set<string>(category.events);

    for (const equipmentGroup of EQUIPMENT_GROUPS) {
      for (const sex of SEXES) {
        const byWeightClass = new Map<number, { entryId: number; value: number }[]>();
        for (let entryId = 0; entryId < entries.length; entryId++) {
          const entry = entries[entryId]!;
          if (entry.sex !== sex) continue;
          if (!eventSet.has(entry.event)) continue;
          if (!equipmentGroup.matches(entry)) continue;
          const value = entry[category.liftField];
          if (value == null) continue;
          const weightClass = entry.weightClassKg;
          if (weightClass == null) continue;

          const list = byWeightClass.get(weightClass);
          const row = { entryId, value };
          if (list == null) byWeightClass.set(weightClass, [row]);
          else list.push(row);
        }

        for (const [weightClassKg, rows] of byWeightClass) {
          rows.sort((a, b) => b.value - a.value);
          const top = rows.slice(0, TOP_N_PER_CLASS);
          for (let rank = 0; rank < top.length; rank++) {
            const r = top[rank]!;
            out.push({
              category: category.key,
              sex,
              equipmentGroup: equipmentGroup.name,
              weightClassKg,
              rank: rank + 1,
              entryId: r.entryId,
              liftValue: r.value,
            });
          }
        }
      }
    }
  }

  return out;
}

export function buildFederations(meets: Meet[]): {
  federations: FederationSummary[];
  meetsByFederation: Map<string, number[]>;
} {
  const counts = new Map<string, { code: string; parent: string | null; meetIds: number[] }>();
  for (let meetId = 0; meetId < meets.length; meetId++) {
    const meet = meets[meetId]!;
    const slug = nameToSlug(meet.federation);
    if (slug.length === 0) continue;
    const existing = counts.get(slug);
    if (existing == null) {
      counts.set(slug, {
        code: meet.federation,
        parent: meet.parentFederation,
        meetIds: [meetId],
      });
    } else {
      existing.meetIds.push(meetId);
    }
  }

  const federations: FederationSummary[] = [];
  const meetsByFederation = new Map<string, number[]>();
  for (const [slug, info] of counts) {
    federations.push({
      slug,
      code: info.code,
      parentSlug: info.parent == null ? null : nameToSlug(info.parent) || null,
      meetCount: info.meetIds.length,
    });
    meetsByFederation.set(slug, info.meetIds);
  }
  federations.sort((a, b) => b.meetCount - a.meetCount);
  return { federations, meetsByFederation };
}
