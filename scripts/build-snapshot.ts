// Builds the SQLite snapshot used at runtime. Downloads the latest
// OpenPowerlifting CSV, parses it, and writes one database under
// src/data/snapshot/:
//
//   snapshot.sqlite      — prebuilt runtime database
//
// Run locally (`npx tsx scripts/build-snapshot.ts`) or in CI. Designed
// so the app opens a ready-to-query database instead of rebuilding data
// structures at boot.

import fs from "node:fs";
import path from "node:path";
import { Readable, type Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import { createLogger } from "../src/utils/logger";
import { buildColumnIndex, normalizeRow, type ColumnIndex } from "../src/data/openpowerlifting-csv";
import { buildSnapshotData, type SnapshotBuildData } from "../src/data/snapshot-build";
import {
  SQLITE_SNAPSHOT_FILENAME,
  createWritableDatabase,
  insertSqliteSnapshot,
} from "../src/data/sqlite";
import type { Entry, Lifter, Meet } from "../src/data/types";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");
const SQLITE_FILE = path.join(SNAPSHOT_DIR, SQLITE_SNAPSHOT_FILENAME);

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`build-snapshot: downloading ${DOWNLOAD_URL}`);
  const { zipPath, sourceLastModified } = await downloadFresh();

  logger.info(`build-snapshot: parsing CSV`);
  const { lifters, meets, entries } = await parseAll(zipPath);

  logger.info("build-snapshot: building snapshot data");
  const snapshotData = buildSnapshotData(lifters, meets, entries);
  const builtAt = new Date().toISOString();
  logger.info(
    `build-snapshot: writing sqlite for ${lifters.length} lifters, ${meets.length} meets, ${entries.length} entries`,
  );
  await writeSqliteSnapshot(lifters, meets, entries, snapshotData, sourceLastModified, builtAt);

  logger.info(`build-snapshot: done`);
  logger.info(`  snapshot.sqlite: ${humanSize(SQLITE_FILE)}`);
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

async function writeSqliteSnapshot(
  lifters: Lifter[],
  meets: Meet[],
  entries: Entry[],
  snapshotData: SnapshotBuildData,
  sourceLastModified: string | null,
  builtAt: string,
): Promise<void> {
  logger.info("build-snapshot: writing sqlite snapshot");
  const db = createWritableDatabase(SQLITE_FILE);
  try {
    insertSqliteSnapshot(db, {
      lifters,
      meets,
      entries,
      bestEntryByLifter: snapshotData.bestEntryByLifter,
      rankByMetric: snapshotData.rankByMetric,
      records: snapshotData.records,
      federations: snapshotData.federations,
      sourceLastModified,
      builtAt,
    });
  } finally {
    db.close();
  }
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
