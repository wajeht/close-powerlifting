// Builds the in-memory snapshot used at runtime. Downloads the latest
// OpenPowerlifting CSV, parses it via the runtime loader, and writes
// three JSON files under src/data/snapshot/:
//
//   lifters.json   — array of { username, name }
//   meets.json     — array of Meet objects
//   entries.json   — column store (one array per field) for compactness
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
  await writeJson(LIFTERS_FILE, lifters);
  await writeJson(MEETS_FILE, meets);
  await writeJson(ENTRIES_FILE, toColumns(entries));
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
  logger.info(`  meets.json: ${humanSize(MEETS_FILE)}`);
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

// Column-store layout: one array per Entry field. Roughly half the JSON size
// of the row-of-objects form because the field names aren't repeated for
// every one of the 3.9M rows.
interface EntriesColumns {
  count: number;
  lifterId: number[];
  meetId: number[];
  sex: (string | null)[];
  age: (number | null)[];
  ageClass: (string | null)[];
  division: (string | null)[];
  lifterCountry: (string | null)[];
  lifterState: (string | null)[];
  event: string[];
  equipment: string[];
  tested: number[]; // 0/1 — half a byte less than `false`/`true` in JSON
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
  placeStatus: (string | null)[];
  dots: (number | null)[];
  wilks: (number | null)[];
  glossbrenner: (number | null)[];
  goodlift: (number | null)[];
}

function toColumns(entries: Entry[]): EntriesColumns {
  const count = entries.length;
  const cols: EntriesColumns = {
    count,
    lifterId: Array.from<number>({ length: count }),
    meetId: Array.from<number>({ length: count }),
    sex: Array.from<string | null>({ length: count }),
    age: Array.from<number | null>({ length: count }),
    ageClass: Array.from<string | null>({ length: count }),
    division: Array.from<string | null>({ length: count }),
    lifterCountry: Array.from<string | null>({ length: count }),
    lifterState: Array.from<string | null>({ length: count }),
    event: Array.from<string>({ length: count }),
    equipment: Array.from<string>({ length: count }),
    tested: Array.from<number>({ length: count }),
    bodyweightKg: Array.from<number | null>({ length: count }),
    weightClassKg: Array.from<number | null>({ length: count }),
    squat1Kg: Array.from<number | null>({ length: count }),
    squat2Kg: Array.from<number | null>({ length: count }),
    squat3Kg: Array.from<number | null>({ length: count }),
    squat4Kg: Array.from<number | null>({ length: count }),
    bench1Kg: Array.from<number | null>({ length: count }),
    bench2Kg: Array.from<number | null>({ length: count }),
    bench3Kg: Array.from<number | null>({ length: count }),
    bench4Kg: Array.from<number | null>({ length: count }),
    deadlift1Kg: Array.from<number | null>({ length: count }),
    deadlift2Kg: Array.from<number | null>({ length: count }),
    deadlift3Kg: Array.from<number | null>({ length: count }),
    deadlift4Kg: Array.from<number | null>({ length: count }),
    best3SquatKg: Array.from<number | null>({ length: count }),
    best3BenchKg: Array.from<number | null>({ length: count }),
    best3DeadliftKg: Array.from<number | null>({ length: count }),
    totalKg: Array.from<number | null>({ length: count }),
    placeRank: Array.from<number | null>({ length: count }),
    placeStatus: Array.from<string | null>({ length: count }),
    dots: Array.from<number | null>({ length: count }),
    wilks: Array.from<number | null>({ length: count }),
    glossbrenner: Array.from<number | null>({ length: count }),
    goodlift: Array.from<number | null>({ length: count }),
  };

  for (let i = 0; i < count; i++) {
    const e = entries[i]!;
    cols.lifterId[i] = e.lifterId;
    cols.meetId[i] = e.meetId;
    cols.sex[i] = e.sex;
    cols.age[i] = e.age;
    cols.ageClass[i] = e.ageClass;
    cols.division[i] = e.division;
    cols.lifterCountry[i] = e.lifterCountry;
    cols.lifterState[i] = e.lifterState;
    cols.event[i] = e.event;
    cols.equipment[i] = e.equipment;
    cols.tested[i] = e.tested ? 1 : 0;
    cols.bodyweightKg[i] = e.bodyweightKg;
    cols.weightClassKg[i] = e.weightClassKg;
    cols.squat1Kg[i] = e.squat1Kg;
    cols.squat2Kg[i] = e.squat2Kg;
    cols.squat3Kg[i] = e.squat3Kg;
    cols.squat4Kg[i] = e.squat4Kg;
    cols.bench1Kg[i] = e.bench1Kg;
    cols.bench2Kg[i] = e.bench2Kg;
    cols.bench3Kg[i] = e.bench3Kg;
    cols.bench4Kg[i] = e.bench4Kg;
    cols.deadlift1Kg[i] = e.deadlift1Kg;
    cols.deadlift2Kg[i] = e.deadlift2Kg;
    cols.deadlift3Kg[i] = e.deadlift3Kg;
    cols.deadlift4Kg[i] = e.deadlift4Kg;
    cols.best3SquatKg[i] = e.best3SquatKg;
    cols.best3BenchKg[i] = e.best3BenchKg;
    cols.best3DeadliftKg[i] = e.best3DeadliftKg;
    cols.totalKg[i] = e.totalKg;
    cols.placeRank[i] = e.placeRank;
    cols.placeStatus[i] = e.placeStatus;
    cols.dots[i] = e.dots;
    cols.wilks[i] = e.wilks;
    cols.glossbrenner[i] = e.glossbrenner;
    cols.goodlift[i] = e.goodlift;
  }

  return cols;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  // No pretty-printing — keeps file size down and makes byte-identical
  // re-runs more likely when upstream hasn't changed.
  await fs.promises.writeFile(file, JSON.stringify(data), "utf8");
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
