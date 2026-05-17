// Data layer. Owns everything between the on-disk snapshot and the route
// handlers: CSV-row normalization (used at build time by
// scripts/build-snapshot.ts), index builders, the stream reader, and the
// in-memory singleton.
//
// Snapshot layout (alongside this module at src/data/snapshot/):
//
//   lifters.json   — JSON array, one Lifter per line
//   meets.json     — JSON array, one Meet per line
//   entries.json   — JSON object, one column per line (column store)
//   meta.json      — sourceLastModified / builtAt / counts
//
// Each line of lifters/meets/entries is independently JSON.parse-able after
// stripping the trailing comma, so we read via readline without ever
// holding the full payload in a single string (entries.json is ~700 MB —
// past V8's per-string max).

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type {
  AppData,
  Entry,
  Equipment,
  EquipmentGroup,
  Event as PowerliftingEvent,
  FederationSummary,
  Lifter,
  Meet,
  MetricInt32Arrays,
  MetricUint32Arrays,
  PlaceStatus,
  RankMetric,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "./types";
import type { LoggerType } from "../utils/logger";

// ---------- Snapshot paths + column list ----------

const SNAPSHOT_DIR = path.join(__dirname, "snapshot");
const LIFTERS_FILE = path.join(SNAPSHOT_DIR, "lifters.json");
const MEETS_FILE = path.join(SNAPSHOT_DIR, "meets.json");
const ENTRIES_FILE = path.join(SNAPSHOT_DIR, "entries.json");
const META_FILE = path.join(SNAPSHOT_DIR, "meta.json");

const ENTRY_COLUMN_NAMES = [
  "lifterId",
  "meetId",
  "sex",
  "age",
  "ageClass",
  "division",
  "lifterCountry",
  "lifterState",
  "event",
  "equipment",
  "tested",
  "bodyweightKg",
  "weightClassKg",
  "squat1Kg",
  "squat2Kg",
  "squat3Kg",
  "squat4Kg",
  "bench1Kg",
  "bench2Kg",
  "bench3Kg",
  "bench4Kg",
  "deadlift1Kg",
  "deadlift2Kg",
  "deadlift3Kg",
  "deadlift4Kg",
  "best3SquatKg",
  "best3BenchKg",
  "best3DeadliftKg",
  "totalKg",
  "placeRank",
  "placeStatus",
  "dots",
  "wilks",
  "glossbrenner",
  "goodlift",
] as const;

// ---------- CSV column schema (consumed by scripts/build-snapshot.ts) ----------
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

// ---------- Index builders (run at boot after the snapshot is read) ----------

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

const RANK_METRICS: ReadonlyArray<RankMetric> = [
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

// ---------- Snapshot reading (runtime) ----------

interface SnapshotMeta {
  sourceLastModified: string | null;
  builtAt: string;
  counts: { lifters: number; meets: number; entries: number };
}

interface EntriesColumns {
  count: number;
  lifterId: number[];
  meetId: number[];
  sex: (Sex | null)[];
  age: (number | null)[];
  ageClass: (string | null)[];
  division: (string | null)[];
  lifterCountry: (string | null)[];
  lifterState: (string | null)[];
  event: PowerliftingEvent[];
  equipment: Equipment[];
  tested: number[];
  bodyweightKg: (number | null)[];
  weightClassKg: (number | null)[];
  squat1Kg: (number | null)[];
  squat2Kg: (number | null)[];
  squat3Kg: (number | null)[];
  squat4Kg: (number | null)[];
  bench1Kg: (number | null)[];
  bench2Kg: (number | null)[];
  bench3Kg: (number | null)[];
  bench4Kg: (number | null)[];
  deadlift1Kg: (number | null)[];
  deadlift2Kg: (number | null)[];
  deadlift3Kg: (number | null)[];
  deadlift4Kg: (number | null)[];
  best3SquatKg: (number | null)[];
  best3BenchKg: (number | null)[];
  best3DeadliftKg: (number | null)[];
  totalKg: (number | null)[];
  placeRank: (number | null)[];
  placeStatus: (PlaceStatus | null)[];
  dots: (number | null)[];
  wilks: (number | null)[];
  glossbrenner: (number | null)[];
  goodlift: (number | null)[];
}

function snapshotExists(): boolean {
  return (
    fs.existsSync(LIFTERS_FILE) &&
    fs.existsSync(MEETS_FILE) &&
    fs.existsSync(ENTRIES_FILE) &&
    fs.existsSync(META_FILE)
  );
}

async function streamReadArray<T>(file: string): Promise<T[]> {
  const items: T[] = [];
  const reader = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const raw of reader) {
    const line = raw.endsWith(",") ? raw.slice(0, -1) : raw;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "[" || trimmed === "]") continue;
    items.push(JSON.parse(trimmed) as T);
  }
  return items;
}

async function streamReadEntries(file: string): Promise<EntriesColumns> {
  const cols = {} as Record<string, unknown>;
  const reader = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const raw of reader) {
    const line = raw.endsWith(",") ? raw.slice(0, -1) : raw;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "{" || trimmed === "}") continue;
    const sepIdx = trimmed.indexOf(":");
    if (sepIdx === -1) {
      throw new Error(`entries.json: malformed line (no colon): ${trimmed.slice(0, 60)}`);
    }
    const name = JSON.parse(trimmed.slice(0, sepIdx)) as string;
    cols[name] = JSON.parse(trimmed.slice(sepIdx + 1));
  }
  if (typeof cols.count !== "number") {
    throw new Error("entries.json: missing or invalid `count` field");
  }
  for (const name of ENTRY_COLUMN_NAMES) {
    if (!Array.isArray(cols[name])) {
      throw new Error(`entries.json: missing or invalid column \`${name}\``);
    }
  }
  return cols as unknown as EntriesColumns;
}

// Reconstructs Entry[] from the column store. Plain object literals; V8
// picks up the monomorphic shape after a few thousand rows so per-row
// access stays fast on the read path.
function fromColumns(cols: EntriesColumns): Entry[] {
  const entries: Entry[] = Array.from<Entry>({ length: cols.count });
  for (let i = 0; i < cols.count; i++) {
    entries[i] = {
      lifterId: cols.lifterId[i]!,
      meetId: cols.meetId[i]!,
      sex: cols.sex[i]!,
      age: cols.age[i]!,
      ageClass: cols.ageClass[i]!,
      division: cols.division[i]!,
      lifterCountry: cols.lifterCountry[i]!,
      lifterState: cols.lifterState[i]!,
      event: cols.event[i]!,
      equipment: cols.equipment[i]!,
      tested: cols.tested[i] === 1,
      bodyweightKg: cols.bodyweightKg[i]!,
      weightClassKg: cols.weightClassKg[i]!,
      squat1Kg: cols.squat1Kg[i]!,
      squat2Kg: cols.squat2Kg[i]!,
      squat3Kg: cols.squat3Kg[i]!,
      squat4Kg: cols.squat4Kg[i]!,
      bench1Kg: cols.bench1Kg[i]!,
      bench2Kg: cols.bench2Kg[i]!,
      bench3Kg: cols.bench3Kg[i]!,
      bench4Kg: cols.bench4Kg[i]!,
      deadlift1Kg: cols.deadlift1Kg[i]!,
      deadlift2Kg: cols.deadlift2Kg[i]!,
      deadlift3Kg: cols.deadlift3Kg[i]!,
      deadlift4Kg: cols.deadlift4Kg[i]!,
      best3SquatKg: cols.best3SquatKg[i]!,
      best3BenchKg: cols.best3BenchKg[i]!,
      best3DeadliftKg: cols.best3DeadliftKg[i]!,
      totalKg: cols.totalKg[i]!,
      placeRank: cols.placeRank[i]!,
      placeStatus: cols.placeStatus[i]!,
      dots: cols.dots[i]!,
      wilks: cols.wilks[i]!,
      glossbrenner: cols.glossbrenner[i]!,
      goodlift: cols.goodlift[i]!,
    };
  }
  return entries;
}

// ---------- Store API ----------

export interface LoadResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
}

export interface DataStoreType {
  load: () => Promise<LoadResult>;
  get: () => AppData;
  tryGet: () => AppData | null;
  set: (next: AppData) => void;
  reset: () => void;
}

let APP: AppData | null = null;

export function createDataStore(logger: LoggerType): DataStoreType {
  async function load(): Promise<LoadResult> {
    const startedAt = Date.now();

    if (!snapshotExists()) {
      throw new Error(
        "data snapshot not found. Run `npx tsx scripts/build-snapshot.ts` to build " +
          "it locally, or wait for the weekly GitHub Actions workflow to commit a fresh one.",
      );
    }

    const meta = JSON.parse(fs.readFileSync(META_FILE, "utf8")) as SnapshotMeta;
    const lifters = await streamReadArray<Lifter>(LIFTERS_FILE);
    const meets = await streamReadArray<Meet>(MEETS_FILE);
    const cols = await streamReadEntries(ENTRIES_FILE);
    const entries = fromColumns(cols);

    const lifterByUsername = new Map<string, number>();
    for (let i = 0; i < lifters.length; i++) lifterByUsername.set(lifters[i]!.username, i);
    const meetByPath = new Map<string, number>();
    for (let i = 0; i < meets.length; i++) meetByPath.set(meets[i]!.path, i);

    const entriesByLifter = buildEntriesByLifter(entries);
    const entriesByMeet = buildEntriesByMeet(entries);
    const bestEntryByLifter = buildBestEntryByLifter(entries, lifters.length, entriesByLifter);
    const rankByMetric = buildRankByMetric(entries, lifters.length, bestEntryByLifter);
    const records = buildRecords(entries);
    const { federations, meetsByFederation } = buildFederations(meets);

    APP = {
      lifters,
      meets,
      entries,
      lifterByUsername,
      meetByPath,
      entriesByLifter,
      entriesByMeet,
      bestEntryByLifter,
      rankByMetric,
      records,
      federations,
      meetsByFederation,
      sourceLastModified: meta.sourceLastModified,
      ingestedAt: meta.builtAt,
      rowCount: entries.length,
    };

    const durationMs = Date.now() - startedAt;
    logger.info(
      `data store ready: ${lifters.length} lifters, ${meets.length} meets, ${entries.length} entries in ${durationMs}ms (source last-modified=${meta.sourceLastModified ?? "unknown"}, built ${meta.builtAt})`,
    );

    return { durationMs, sourceLastModified: meta.sourceLastModified, rowCount: entries.length };
  }

  function get(): AppData {
    if (APP == null) {
      throw new Error("AppData not ready — boot has not finished loading the snapshot");
    }
    return APP;
  }

  function tryGet(): AppData | null {
    return APP;
  }

  function set(next: AppData): void {
    APP = next;
  }

  function reset(): void {
    APP = null;
  }

  return { load, get, tryGet, set, reset };
}
