// Builds the in-memory snapshot used at runtime. Downloads the latest
// OpenPowerlifting CSV, parses it, and writes JSON files under
// src/data/snapshot/:
//
//   lifters.json    — array of { username, name }
//   meets.json      — array of Meet objects
//   entries/*.json  — column store (one file per Entry field). One file per
//                     column keeps each JSON.stringify call well under V8's
//                     ~512 MB max string length for 3.9M-row datasets.
//   meta.json       — sourceLastModified / builtAt / counts
//
// Run locally (`npx tsx scripts/build-snapshot.ts`) or in CI. Designed to
// produce stable output for git: a re-run against an unchanged CSV writes
// byte-identical files, so the workflow PR step skips when nothing moved.

import fs from "node:fs";
import path from "node:path";
import { Readable, type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import { createLogger } from "../src/utils/logger";
import { buildColumnIndex, normalizeRow, type ColumnIndex } from "../src/data/normalize";
import type { Entry, Lifter, Meet } from "../src/data/types";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");
const ENTRIES_DIR = path.join(SNAPSHOT_DIR, "entries");
const LIFTERS_FILE = path.join(SNAPSHOT_DIR, "lifters.json");
const MEETS_FILE = path.join(SNAPSHOT_DIR, "meets.json");
const META_FILE = path.join(SNAPSHOT_DIR, "meta.json");

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.promises.mkdir(ENTRIES_DIR, { recursive: true });

  logger.info(`build-snapshot: downloading ${DOWNLOAD_URL}`);
  const { zipPath, sourceLastModified } = await downloadFresh();

  logger.info(`build-snapshot: parsing CSV`);
  const { lifters, meets, entries } = await parseAll(zipPath);

  logger.info(
    `build-snapshot: writing ${lifters.length} lifters, ${meets.length} meets, ${entries.length} entries`,
  );
  await writeJson(LIFTERS_FILE, lifters);
  await writeJson(MEETS_FILE, meets);
  await writeEntryColumns(entries);
  await writeJson(META_FILE, {
    sourceLastModified,
    builtAt: new Date().toISOString(),
    counts: {
      lifters: lifters.length,
      meets: meets.length,
      entries: entries.length,
    },
  });

  logger.info(`build-snapshot: done`);
  logger.info(`  lifters.json: ${humanSize(LIFTERS_FILE)}`);
  logger.info(`  meets.json:   ${humanSize(MEETS_FILE)}`);
  const entriesSize = await dirSize(ENTRIES_DIR);
  logger.info(`  entries/:     ${humanBytes(entriesSize)}`);
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

// Column-store layout: one file per Entry field under entries/. Each
// column is a plain JSON array; the row index lines up across columns,
// so entries[i] = { lifterId: lifterId[i], meetId: meetId[i], ... }.
// One file per column is both leaner than a row-of-objects form (no
// repeated keys) and small enough that JSON.stringify never approaches
// V8's per-string ceiling.

type ColumnExtractor<T> = (e: Entry) => T;

const ENTRY_COLUMNS: ReadonlyArray<readonly [string, ColumnExtractor<unknown>]> = [
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

async function writeEntryColumns(entries: Entry[]): Promise<void> {
  const count = entries.length;
  for (const [name, extract] of ENTRY_COLUMNS) {
    const column: unknown[] = Array.from({ length: count });
    for (let i = 0; i < count; i++) column[i] = extract(entries[i]!);
    await writeJson(path.join(ENTRIES_DIR, `${name}.json`), column);
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  // No pretty-printing — keeps file size down and makes byte-identical
  // re-runs more likely when upstream hasn't changed.
  await fs.promises.writeFile(file, JSON.stringify(data), "utf8");
}

function humanSize(file: string): string {
  return humanBytes(fs.statSync(file).size);
}

function humanBytes(bytes: number): string {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function dirSize(dir: string): Promise<number> {
  const files = await fs.promises.readdir(dir);
  let total = 0;
  for (const file of files) {
    const stat = await fs.promises.stat(path.join(dir, file));
    if (stat.isFile()) total += stat.size;
  }
  return total;
}

main().catch((err: Error) => {
  logger.error("build-snapshot: failed", err);
  process.exit(1);
});
