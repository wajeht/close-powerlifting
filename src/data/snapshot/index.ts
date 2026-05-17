// Loads the pre-built snapshot files committed to the repo. Built by
// scripts/build-snapshot.ts and refreshed weekly by a GitHub Actions
// workflow. The server picks this up at boot in preference to downloading
// + parsing the OPL CSV — so a container with the snapshot baked in
// reaches /healthz=200 in seconds instead of minutes.
//
// The snapshot lives as plain JSON files alongside this module:
//
//   lifters.json   — array of { username, name }
//   meets.json     — array of Meet objects
//   entries.json   — column store (one array per field); rebuilt into
//                    Entry[] when we materialise the runtime AppData
//   meta.json      — sourceLastModified / builtAt / counts
//
// Returns null if the snapshot files aren't present (fresh clone before
// the first build, or local dev). The runtime loader falls back to the
// CSV download in that case.

import fs from "node:fs";
import path from "node:path";

import type {
  AppData,
  Entry,
  Equipment,
  Event as PowerliftingEvent,
  Lifter,
  Meet,
  PlaceStatus,
  Sex,
} from "../types";
import type { LoggerType } from "../../utils/logger";
import {
  buildBestEntryByLifter,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
} from "../indexes";

const SNAPSHOT_DIR = __dirname;
const LIFTERS_FILE = path.join(SNAPSHOT_DIR, "lifters.json");
const MEETS_FILE = path.join(SNAPSHOT_DIR, "meets.json");
const ENTRIES_FILE = path.join(SNAPSHOT_DIR, "entries.json");
const META_FILE = path.join(SNAPSHOT_DIR, "meta.json");

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

// Returns the path on disk that holds the snapshot. Resolves to the source
// tree in dev (src/data/snapshot) and the compiled tree in prod
// (dist/src/data/snapshot) via __dirname — the JSON files are copied
// alongside the compiled JS by the Dockerfile.
export function snapshotExists(): boolean {
  return (
    fs.existsSync(LIFTERS_FILE) &&
    fs.existsSync(MEETS_FILE) &&
    fs.existsSync(ENTRIES_FILE) &&
    fs.existsSync(META_FILE)
  );
}

// Reads the snapshot files and builds the runtime AppData with all the
// precomputed indexes. Throws if any file is missing or malformed — call
// snapshotExists() first to fall back to the CSV path cleanly.
export function loadSnapshot(logger: LoggerType): AppData {
  const startedAt = Date.now();

  const lifters = JSON.parse(fs.readFileSync(LIFTERS_FILE, "utf8")) as Lifter[];
  const meets = JSON.parse(fs.readFileSync(MEETS_FILE, "utf8")) as Meet[];
  const cols = JSON.parse(fs.readFileSync(ENTRIES_FILE, "utf8")) as EntriesColumns;
  const meta = JSON.parse(fs.readFileSync(META_FILE, "utf8")) as SnapshotMeta;

  const entries = fromColumns(cols);

  // Lookup maps and precomputed indexes — same calls the CSV loader uses.
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

  logger.info(
    `snapshot: loaded ${lifters.length} lifters, ${meets.length} meets, ${entries.length} entries in ${Date.now() - startedAt}ms (built ${meta.builtAt})`,
  );

  return {
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
}

// Reconstructs Entry[] from the column-store JSON. Plain object literals;
// V8 picks up the monomorphic shape after a few thousand rows so per-row
// access stays fast on the read path.
function fromColumns(cols: EntriesColumns): Entry[] {
  const entries: Entry[] = new Array<Entry>(cols.count);
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
