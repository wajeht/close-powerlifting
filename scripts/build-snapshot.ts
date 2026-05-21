// Builds the in-memory snapshot used at runtime. Downloads the latest
// OpenPowerlifting CSV, parses it, and writes JSON files under
// src/data/snapshot/:
//
//   lifters.json  — JSON array, one Lifter object per line
//   meets.json    — JSON array, one Meet object per line
//   entries.json  — JSON object, one column per line (column store).
//                   Each value is the JSON-encoded array for that field.
//   runtime-indexes.json — manifest + small precomputed runtime indexes
//   runtime-indexes.bin  — binary typed-array indexes used at boot
//   meta.json     — sourceLastModified / builtAt / counts
//
// All large files are stream-written via pipeline + Readable.from so we
// never hold the full payload in a single string (3.9 M-row entries
// data is ~700 MB, far past V8's per-string max). The on-disk format is
// still valid JSON — each line is independently parseable, so the
// runtime can stream-read with readline + JSON.parse per line.
//
// Run locally (`npx tsx scripts/build-snapshot.ts`) or in CI. Designed
// to produce stable output for git: a re-run against an unchanged CSV
// writes byte-identical files, so the workflow PR step skips when
// nothing moved.

import fs from "node:fs";
import path from "node:path";
import { Readable, type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import { createLogger } from "../src/utils/logger";
import {
  RANK_METRICS,
  buildBestEntryByLifter,
  buildColumnIndex,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
  normalizeRow,
  type ColumnIndex,
} from "../src/data/store";
import type { Entry, FederationSummary, Lifter, Meet, WeightClassRecord } from "../src/data/types";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");
const LIFTERS_FILE = path.join(SNAPSHOT_DIR, "lifters.json");
const MEETS_FILE = path.join(SNAPSHOT_DIR, "meets.json");
const ENTRIES_FILE = path.join(SNAPSHOT_DIR, "entries.json");
const RUNTIME_INDEXES_FILE = path.join(SNAPSHOT_DIR, "runtime-indexes.json");
const RUNTIME_INDEXES_BIN_FILE = path.join(SNAPSHOT_DIR, "runtime-indexes.bin");
const META_FILE = path.join(SNAPSHOT_DIR, "meta.json");
const RUNTIME_INDEX_FORMAT_VERSION = 1;

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`build-snapshot: downloading ${DOWNLOAD_URL}`);
  const { zipPath, sourceLastModified } = await downloadFresh();

  logger.info(`build-snapshot: parsing CSV`);
  const { lifters, meets, entries } = await parseAll(zipPath);

  logger.info(
    `build-snapshot: writing ${lifters.length} lifters, ${meets.length} meets, ${entries.length} entries`,
  );
  await streamWriteArray(LIFTERS_FILE, lifters);
  await streamWriteArray(MEETS_FILE, meets);
  await streamWriteEntries(ENTRIES_FILE, entries);
  await writeRuntimeIndexes(lifters, meets, entries);
  await fs.promises.writeFile(
    META_FILE,
    JSON.stringify({
      sourceLastModified,
      builtAt: new Date().toISOString(),
      counts: {
        lifters: lifters.length,
        meets: meets.length,
        entries: entries.length,
      },
    }),
    "utf8",
  );

  logger.info(`build-snapshot: done`);
  logger.info(`  lifters.json: ${humanSize(LIFTERS_FILE)}`);
  logger.info(`  meets.json:   ${humanSize(MEETS_FILE)}`);
  logger.info(`  entries.json: ${humanSize(ENTRIES_FILE)}`);
  logger.info(`  runtime-indexes.json: ${humanSize(RUNTIME_INDEXES_FILE)}`);
  logger.info(`  runtime-indexes.bin:  ${humanSize(RUNTIME_INDEXES_BIN_FILE)}`);
}

async function downloadFresh(): Promise<{ zipPath: string; sourceLastModified: string | null }> {
  const tempDir = await fs.promises.mkdtemp(path.join(SNAPSHOT_DIR, ".tmp-"));
  const zipPath = path.join(tempDir, "opl.zip");

  const response = await fetch(DOWNLOAD_URL);
  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download OPL CSV: HTTP ${response.status}`);
  }
  const sourceLastModified = response.headers.get("last-modified");
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(zipPath));

  return { zipPath, sourceLastModified };
}

async function parseAll(
  zipPath: string,
): Promise<{ lifters: Lifter[]; meets: Meet[]; entries: Entry[] }> {
  const directory = await unzipper.Open.file(zipPath);
  const csvEntry = directory.files.find((f) => f.path.endsWith(".csv") && f.type === "File");
  if (csvEntry == null) throw new Error("Zip archive has no CSV inside");

  const lifters: Lifter[] = [];
  const meets: Meet[] = [];
  const entries: Entry[] = [];
  const lifterByUsername = new Map<string, number>();
  const meetByPath = new Map<string, number>();

  let columnIndex: ColumnIndex | null = null;
  let rowIdx = 0;
  let rowsSkipped = 0;

  await pipeline(
    csvEntry.stream(),
    createCsvParser(),
    async function (rows: AsyncIterable<string[]>) {
      for await (const row of rows) {
        if (columnIndex == null) {
          columnIndex = buildColumnIndex(row);
          continue;
        }
        const normalized = normalizeRow(row, columnIndex, rowIdx);
        rowIdx++;
        if (normalized == null) {
          rowsSkipped++;
          continue;
        }

        let lifterId = lifterByUsername.get(normalized.lifterUsername);
        if (lifterId == null) {
          lifterId = lifters.length;
          lifters.push({ username: normalized.lifterUsername, name: normalized.lifterName });
          lifterByUsername.set(normalized.lifterUsername, lifterId);
        }

        let meetId = meetByPath.get(normalized.meetPath);
        if (meetId == null) {
          meetId = meets.length;
          meets.push(normalized.meet);
          meetByPath.set(normalized.meetPath, meetId);
        }

        entries.push({ ...normalized.entry, lifterId, meetId });
      }
    },
  );

  if (rowsSkipped > 0) logger.warn(`build-snapshot: skipped ${rowsSkipped} malformed rows`);

  return { lifters, meets, entries };
}

function createCsvParser(): Transform {
  return parseCsv({ columns: false, skip_empty_lines: true, relax_column_count: true });
}

type ColumnExtractor = (e: Entry) => unknown;

// Column-store layout: one line per Entry field inside a JSON object.
// Each line is `"<name>":<json-array>` (with a trailing comma except the
// last). The whole file is valid JSON — each line is independently
// JSON.parse-able after stripping the trailing comma — so the runtime
// can stream-read it via readline without ever holding the full ~700 MB
// payload in a single string.
const ENTRY_COLUMNS: ReadonlyArray<readonly [string, ColumnExtractor]> = [
  ["lifterId", (e) => e.lifterId],
  ["meetId", (e) => e.meetId],
  ["sex", (e) => e.sex],
  ["age", (e) => e.age],
  ["ageClass", (e) => e.ageClass],
  ["division", (e) => e.division],
  ["lifterCountry", (e) => e.lifterCountry],
  ["lifterState", (e) => e.lifterState],
  ["event", (e) => e.event],
  ["equipment", (e) => e.equipment],
  ["tested", (e) => (e.tested ? 1 : 0)],
  ["bodyweightKg", (e) => e.bodyweightKg],
  ["weightClassKg", (e) => e.weightClassKg],
  ["squat1Kg", (e) => e.squat1Kg],
  ["squat2Kg", (e) => e.squat2Kg],
  ["squat3Kg", (e) => e.squat3Kg],
  ["squat4Kg", (e) => e.squat4Kg],
  ["bench1Kg", (e) => e.bench1Kg],
  ["bench2Kg", (e) => e.bench2Kg],
  ["bench3Kg", (e) => e.bench3Kg],
  ["bench4Kg", (e) => e.bench4Kg],
  ["deadlift1Kg", (e) => e.deadlift1Kg],
  ["deadlift2Kg", (e) => e.deadlift2Kg],
  ["deadlift3Kg", (e) => e.deadlift3Kg],
  ["deadlift4Kg", (e) => e.deadlift4Kg],
  ["best3SquatKg", (e) => e.best3SquatKg],
  ["best3BenchKg", (e) => e.best3BenchKg],
  ["best3DeadliftKg", (e) => e.best3DeadliftKg],
  ["totalKg", (e) => e.totalKg],
  ["placeRank", (e) => e.placeRank],
  ["placeStatus", (e) => e.placeStatus],
  ["dots", (e) => e.dots],
  ["wilks", (e) => e.wilks],
  ["glossbrenner", (e) => e.glossbrenner],
  ["goodlift", (e) => e.goodlift],
];

async function streamWriteArray<T>(file: string, items: T[]): Promise<void> {
  await pipeline(Readable.from(generateArrayLines(items)), fs.createWriteStream(file));
}

async function* generateArrayLines<T>(items: T[]): AsyncGenerator<string> {
  yield "[\n";
  const last = items.length - 1;
  for (let i = 0; i < items.length; i++) {
    yield JSON.stringify(items[i]);
    yield i < last ? ",\n" : "\n";
  }
  yield "]\n";
}

async function streamWriteEntries(file: string, entries: Entry[]): Promise<void> {
  await pipeline(Readable.from(generateEntriesLines(entries)), fs.createWriteStream(file));
}

async function* generateEntriesLines(entries: Entry[]): AsyncGenerator<string> {
  yield "{\n";
  yield `"count":${entries.length}`;
  for (const [name, extract] of ENTRY_COLUMNS) {
    const column: unknown[] = Array.from({ length: entries.length });
    for (let i = 0; i < entries.length; i++) column[i] = extract(entries[i]!);
    yield `,\n${JSON.stringify(name)}:${JSON.stringify(column)}`;
  }
  yield "\n}\n";
}

type RuntimeIndexSegmentType = "int32" | "uint32";

interface RuntimeIndexSegment {
  type: RuntimeIndexSegmentType;
  offset: number;
  length: number;
  byteLength: number;
}

interface RuntimeIndexManifest {
  version: number;
  counts: {
    lifters: number;
    meets: number;
    entries: number;
  };
  segments: Record<string, RuntimeIndexSegment>;
  records: WeightClassRecord[];
  federations: FederationSummary[];
  meetsByFederation: [string, number[]][];
}

interface BinaryIndexBuild {
  chunks: Buffer[];
  segments: Record<string, RuntimeIndexSegment>;
  offset: number;
}

async function writeRuntimeIndexes(
  lifters: Lifter[],
  meets: Meet[],
  entries: Entry[],
): Promise<void> {
  logger.info("build-snapshot: building runtime indexes");
  const entriesByLifter = buildEntriesByLifter(entries);
  const entriesByMeet = buildEntriesByMeet(entries);
  const bestEntryByLifter = buildBestEntryByLifter(entries, lifters.length, entriesByLifter);
  const rankByMetric = buildRankByMetric(entries, lifters.length, bestEntryByLifter);
  const records = buildRecords(entries);
  const { federations, meetsByFederation } = buildFederations(meets);

  const binary: BinaryIndexBuild = { chunks: [], segments: {}, offset: 0 };
  const lifterIndex = mapToCsr(entriesByLifter, lifters.length);
  addSegment(binary, "entriesByLifter.offsets", lifterIndex.offsets, "uint32");
  addSegment(binary, "entriesByLifter.values", lifterIndex.values, "uint32");

  const meetIndex = mapToCsr(entriesByMeet, meets.length);
  addSegment(binary, "entriesByMeet.offsets", meetIndex.offsets, "uint32");
  addSegment(binary, "entriesByMeet.values", meetIndex.values, "uint32");

  for (const metric of RANK_METRICS) {
    addSegment(binary, `bestEntryByLifter.${metric}`, bestEntryByLifter[metric], "int32");
    addSegment(binary, `rankByMetric.${metric}`, rankByMetric[metric], "uint32");
  }

  await fs.promises.writeFile(
    RUNTIME_INDEXES_BIN_FILE,
    Buffer.concat(binary.chunks, binary.offset),
  );

  const manifest: RuntimeIndexManifest = {
    version: RUNTIME_INDEX_FORMAT_VERSION,
    counts: {
      lifters: lifters.length,
      meets: meets.length,
      entries: entries.length,
    },
    segments: binary.segments,
    records,
    federations,
    meetsByFederation: Array.from(meetsByFederation.entries()),
  };
  await fs.promises.writeFile(RUNTIME_INDEXES_FILE, JSON.stringify(manifest), "utf8");
}

function mapToCsr(
  map: Map<number, number[]>,
  count: number,
): {
  offsets: Uint32Array;
  values: Uint32Array;
} {
  const offsets = new Uint32Array(count + 1);
  let total = 0;
  for (let id = 0; id < count; id++) {
    offsets[id] = total;
    total += map.get(id)?.length ?? 0;
  }
  offsets[count] = total;

  const values = new Uint32Array(total);
  let cursor = 0;
  for (let id = 0; id < count; id++) {
    const ids = map.get(id);
    if (ids == null) continue;
    values.set(ids, cursor);
    cursor += ids.length;
  }

  return { offsets, values };
}

function addSegment(
  binary: BinaryIndexBuild,
  name: string,
  array: Int32Array | Uint32Array,
  type: RuntimeIndexSegmentType,
): void {
  const byteLength = array.byteLength;
  binary.chunks.push(Buffer.from(array.buffer, array.byteOffset, byteLength));
  binary.segments[name] = {
    type,
    offset: binary.offset,
    length: array.length,
    byteLength,
  };
  binary.offset += byteLength;
}

function humanSize(file: string): string {
  const bytes = fs.statSync(file).size;
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

main().catch((err: Error) => {
  logger.error("build-snapshot: failed", err);
  process.exit(1);
});
