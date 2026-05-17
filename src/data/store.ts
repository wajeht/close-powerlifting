// In-memory data store. Stream-reads the pre-built snapshot from disk at
// boot, materialises AppData (with all precomputed indexes), and exposes
// it through a sync getter that route handlers can call without thinking
// about lifecycle.
//
// The snapshot is produced by `scripts/build-snapshot.ts` (locally or via
// the weekly `update-data.yml` workflow) and committed to the repo, so
// the runtime never touches the network.
//
// Snapshot layout (alongside this module at src/data/snapshot/):
//
//   lifters.json   — JSON array, one Lifter per line
//   meets.json     — JSON array, one Meet per line
//   entries.json   — JSON object, one column per line (column store)
//   meta.json      — sourceLastModified / builtAt / counts
//
// Each line of lifters/meets/entries is independently JSON.parse-able
// after stripping the trailing comma, so we read via readline without
// ever holding the full payload in a single string. Entries.json is
// ~700 MB which would otherwise blow past V8's per-string max.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import {
  buildBestEntryByLifter,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
} from "./indexes";
import type {
  AppData,
  Entry,
  Equipment,
  Event as PowerliftingEvent,
  Lifter,
  Meet,
  PlaceStatus,
  Sex,
} from "./types";
import type { LoggerType } from "../utils/logger";

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

export interface LoadResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
}

export interface DataStoreType {
  // Stream-reads the on-disk snapshot, builds the indexes, and installs
  // the AppData. Resolves once /healthz can flip to 200.
  load: () => Promise<LoadResult>;
  // Returns the current snapshot. Throws if `load` hasn't completed.
  get: () => AppData;
  // Returns the snapshot or null. Used by /healthz to report "not ready"
  // without throwing.
  tryGet: () => AppData | null;
  // Test/teardown only.
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

  function reset(): void {
    APP = null;
  }

  return { load, get, tryGet, reset };
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
