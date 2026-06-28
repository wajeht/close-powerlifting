// Builds the precomputed SQLite database used at runtime. The app opens
// this file read-only; it never ingests CSV or runs migrations on boot.

import fs from "node:fs";
import path from "node:path";
import { Readable, type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import Database, { type Database as DatabaseType, type Statement } from "better-sqlite3";
import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import { createLogger } from "../src/utils/logger";
import { countRows, createDerivedTables } from "../src/data/materialized-tables";
import {
  buildColumnIndex,
  nameToSlug,
  normalizeRow,
  type ColumnIndex,
  type NormalizedRow,
} from "../src/data/csv-normalization";
import type { Entry } from "../src/data/types";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");
const DATABASE_FILE = path.join(SNAPSHOT_DIR, "close-powerlifting.sqlite");
const SCHEMA_VERSION = 1;

const logger = createLogger();

interface ParseResult {
  lifters: number;
  meets: number;
  entries: number;
  skipped: number;
}

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`build-database: downloading ${DOWNLOAD_URL}`);
  const { zipPath, sourceLastModified } = await downloadFresh();
  const tmpDatabase = path.join(SNAPSHOT_DIR, `.tmp-${Date.now()}-close-powerlifting.sqlite`);

  if (fs.existsSync(tmpDatabase)) fs.unlinkSync(tmpDatabase);

  const db = new Database(tmpDatabase);
  try {
    configureBuildPragmas(db);
    createSchema(db);

    logger.info("build-database: parsing CSV into SQLite");
    const result = await parseIntoDatabase(zipPath, db);
    logger.info(
      `build-database: loaded ${result.lifters} lifters, ${result.meets} meets, ${result.entries} entries (${result.skipped} skipped)`,
    );

    logger.info("build-database: creating indexes and materialized tables");
    createIndexes(db);
    createDerivedTables(db);
    writeMetadata(db, sourceLastModified, result);
    finalizeDatabase(db);
  } finally {
    db.close();
  }

  fs.renameSync(tmpDatabase, DATABASE_FILE);
  logger.info(`build-database: wrote ${DATABASE_FILE} (${humanSize(DATABASE_FILE)})`);
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

function configureBuildPragmas(db: DatabaseType): void {
  db.pragma("journal_mode = OFF");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -524288");
  db.pragma("locking_mode = EXCLUSIVE");
}

function createSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE lifters (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE meets (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      federation TEXT NOT NULL,
      federation_slug TEXT NOT NULL,
      parent_federation TEXT,
      parent_federation_slug TEXT,
      date TEXT NOT NULL,
      meet_name TEXT NOT NULL,
      meet_country TEXT,
      meet_state TEXT,
      meet_town TEXT,
      ruleset TEXT,
      sanctioned INTEGER NOT NULL
    );

    CREATE TABLE entries (
      id INTEGER PRIMARY KEY,
      lifter_id INTEGER NOT NULL,
      meet_id INTEGER NOT NULL,
      sex TEXT,
      age REAL,
      age_class TEXT,
      division TEXT,
      lifter_country TEXT,
      lifter_state TEXT,
      event TEXT NOT NULL,
      equipment TEXT NOT NULL,
      tested INTEGER NOT NULL,
      bodyweight_kg REAL,
      weight_class_kg REAL,
      squat1_kg REAL,
      squat2_kg REAL,
      squat3_kg REAL,
      squat4_kg REAL,
      bench1_kg REAL,
      bench2_kg REAL,
      bench3_kg REAL,
      bench4_kg REAL,
      deadlift1_kg REAL,
      deadlift2_kg REAL,
      deadlift3_kg REAL,
      deadlift4_kg REAL,
      best3_squat_kg REAL,
      best3_bench_kg REAL,
      best3_deadlift_kg REAL,
      total_kg REAL,
      place_rank INTEGER,
      place_status TEXT,
      dots REAL,
      wilks REAL,
      glossbrenner REAL,
      goodlift REAL
    );
  `);
}

async function parseIntoDatabase(zipPath: string, db: DatabaseType): Promise<ParseResult> {
  const directory = await unzipper.Open.file(zipPath);
  const csvEntry = directory.files.find(isCsvFile);
  if (csvEntry == null) throw new Error("Zip archive has no CSV inside");

  const lifterByUsername = new Map<string, number>();
  const meetByPath = new Map<string, number>();

  const insertLifter = db.prepare("INSERT INTO lifters (username, name) VALUES (?, ?)");
  const insertMeet = db.prepare(`
    INSERT INTO meets (
      path, federation, federation_slug, parent_federation, parent_federation_slug,
      date, meet_name, meet_country, meet_state, meet_town, ruleset, sanctioned
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = db.prepare(`
    INSERT INTO entries (
      lifter_id, meet_id, sex, age, age_class, division, lifter_country, lifter_state,
      event, equipment, tested, bodyweight_kg, weight_class_kg,
      squat1_kg, squat2_kg, squat3_kg, squat4_kg,
      bench1_kg, bench2_kg, bench3_kg, bench4_kg,
      deadlift1_kg, deadlift2_kg, deadlift3_kg, deadlift4_kg,
      best3_squat_kg, best3_bench_kg, best3_deadlift_kg, total_kg,
      place_rank, place_status, dots, wilks, glossbrenner, goodlift
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  let columnIndex: ColumnIndex | null = null;
  let rowIdx = 0;
  let skipped = 0;
  let entries = 0;

  db.exec("BEGIN");
  try {
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
            skipped++;
            continue;
          }

          const lifterId = getOrInsertLifter(normalized, lifterByUsername, insertLifter);
          const meetId = getOrInsertMeet(normalized, meetByPath, insertMeet);
          insertEntry.run(...entryValues(normalized.entry, lifterId, meetId));
          entries++;
        }
      },
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { lifters: lifterByUsername.size, meets: meetByPath.size, entries, skipped };
}

function isCsvFile(file: unzipper.File): boolean {
  return file.path.endsWith(".csv") && file.type === "File";
}

function createCsvParser(): Transform {
  return parseCsv({ columns: false, skip_empty_lines: true, relax_column_count: true });
}

function getOrInsertLifter(
  normalized: NormalizedRow,
  lifterByUsername: Map<string, number>,
  insertLifter: Statement,
): number {
  const existing = lifterByUsername.get(normalized.lifterUsername);
  if (existing != null) return existing;

  const result = insertLifter.run(normalized.lifterUsername, normalized.lifterName);
  const id = Number(result.lastInsertRowid);
  lifterByUsername.set(normalized.lifterUsername, id);
  return id;
}

function getOrInsertMeet(
  normalized: NormalizedRow,
  meetByPath: Map<string, number>,
  insertMeet: Statement,
): number {
  const existing = meetByPath.get(normalized.meetPath);
  if (existing != null) return existing;

  const meet = normalized.meet;
  const result = insertMeet.run(
    meet.path,
    meet.federation,
    nameToSlug(meet.federation),
    meet.parentFederation,
    meet.parentFederation == null ? null : nameToSlug(meet.parentFederation) || null,
    meet.date,
    meet.meetName,
    meet.meetCountry,
    meet.meetState,
    meet.meetTown,
    meet.ruleset,
    meet.sanctioned ? 1 : 0,
  );
  const id = Number(result.lastInsertRowid);
  meetByPath.set(normalized.meetPath, id);
  return id;
}

function entryValues(entry: Omit<Entry, "lifterId" | "meetId">, lifterId: number, meetId: number) {
  return [
    lifterId,
    meetId,
    entry.sex,
    entry.age,
    entry.ageClass,
    entry.division,
    entry.lifterCountry,
    entry.lifterState,
    entry.event,
    entry.equipment,
    entry.tested ? 1 : 0,
    entry.bodyweightKg,
    entry.weightClassKg,
    entry.squat1Kg,
    entry.squat2Kg,
    entry.squat3Kg,
    entry.squat4Kg,
    entry.bench1Kg,
    entry.bench2Kg,
    entry.bench3Kg,
    entry.bench4Kg,
    entry.deadlift1Kg,
    entry.deadlift2Kg,
    entry.deadlift3Kg,
    entry.deadlift4Kg,
    entry.best3SquatKg,
    entry.best3BenchKg,
    entry.best3DeadliftKg,
    entry.totalKg,
    entry.placeRank,
    entry.placeStatus,
    entry.dots,
    entry.wilks,
    entry.glossbrenner,
    entry.goodlift,
  ];
}

function createIndexes(db: DatabaseType): void {
  db.exec(`
    CREATE INDEX idx_lifters_username ON lifters(username);
    CREATE INDEX idx_lifters_name ON lifters(name);
    CREATE INDEX idx_meets_path ON meets(path);
    CREATE INDEX idx_meets_federation_slug ON meets(federation_slug);
    CREATE INDEX idx_meets_date ON meets(date);
    CREATE INDEX idx_entries_lifter_id ON entries(lifter_id);
    CREATE INDEX idx_entries_meet_id ON entries(meet_id);
    CREATE INDEX idx_entries_filter ON entries(equipment, sex, weight_class_kg, event, age_class);
    CREATE INDEX idx_entries_dots ON entries(dots);
    CREATE INDEX idx_entries_total ON entries(total_kg);
  `);
}

function writeMetadata(
  db: DatabaseType,
  sourceLastModified: string | null,
  result: ParseResult,
): void {
  const insert = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  insert.run("schema_version", String(SCHEMA_VERSION));
  insert.run("source_last_modified", sourceLastModified ?? "");
  insert.run("built_at", new Date().toISOString());
  insert.run("lifters", String(result.lifters));
  insert.run("meets", String(result.meets));
  insert.run("entries", String(result.entries));
  insert.run("federations", String(countRows(db, "federations")));
  insert.run("records", String(countRows(db, "records")));
}

function finalizeDatabase(db: DatabaseType): void {
  db.pragma("user_version = " + SCHEMA_VERSION);
  db.exec("ANALYZE");
  db.exec("VACUUM");
}

function humanSize(file: string): string {
  const bytes = fs.statSync(file).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

main().catch((error: unknown) => {
  logger.error("build-database: failed", error);
  process.exit(1);
});
