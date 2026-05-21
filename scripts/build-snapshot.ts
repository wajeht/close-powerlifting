// Builds the in-memory snapshot used at runtime. Downloads the latest
// OpenPowerlifting CSV, parses it, and writes JSON files under
// src/data/snapshot/:
//
//   lifters.json  — JSON array, one Lifter object per line
//   meets.json    — JSON array, one Meet object per line
//   entries.json  — JSON object, one column per line (column store).
//                   Each value is the JSON-encoded array for that field.
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
import { buildColumnIndex, normalizeRow, type ColumnIndex } from "../src/data/store";
import type { Entry, Lifter, Meet } from "../src/data/types";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");
const LIFTERS_FILE = path.join(SNAPSHOT_DIR, "lifters.json");
const MEETS_FILE = path.join(SNAPSHOT_DIR, "meets.json");
const ENTRIES_FILE = path.join(SNAPSHOT_DIR, "entries.json");
const META_FILE = path.join(SNAPSHOT_DIR, "meta.json");

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
