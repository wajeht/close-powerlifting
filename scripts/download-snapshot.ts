// Downloads the prebuilt SQLite snapshot from the configured GitHub Release.
// If the asset is missing or stale during a schema rollout, it falls back to
// rebuilding the database locally from the upstream OPL CSV.

import Database from "better-sqlite3";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

import { buildDatabase } from "../src/data/database-builder";
import {
  DATABASE_ARCHIVE_FILE_NAME,
  DATABASE_FILE,
  DATABASE_FILE_NAME,
  DATABASE_SCHEMA_VERSION,
  SNAPSHOT_DIR,
} from "../src/data/database-files";
import { createLogger } from "../src/utils/logger";

const REPO = process.env.SNAPSHOT_REPO ?? "wajeht/close-powerlifting";
const TAG = process.env.SNAPSHOT_TAG ?? "snapshot-latest";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;

const logger = createLogger();

interface SchemaVersionRow {
  value: string;
}

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`download-snapshot: source ${BASE_URL}`);
  logger.info(`download-snapshot: fetching ${DATABASE_ARCHIVE_FILE_NAME}`);
  try {
    await downloadCompressedTo(`${BASE_URL}/${DATABASE_ARCHIVE_FILE_NAME}`, DATABASE_FILE);
    assertSupportedSchema(DATABASE_FILE);
    logger.info(`download-snapshot: wrote ${DATABASE_FILE_NAME} (${humanSize(DATABASE_FILE)})`);
  } catch (error) {
    await fs.promises.rm(DATABASE_FILE, { force: true });
    logger.warn(
      "download-snapshot: compressed SQLite snapshot unavailable; trying raw asset",
      error,
    );
    await downloadRawOrBuild();
  }
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(dest));
}

async function downloadCompressedTo(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body as never),
    createGunzip(),
    fs.createWriteStream(dest),
  );
}

async function downloadRawOrBuild(): Promise<void> {
  logger.info(`download-snapshot: fetching ${DATABASE_FILE_NAME}`);
  try {
    await downloadTo(`${BASE_URL}/${DATABASE_FILE_NAME}`, DATABASE_FILE);
    assertSupportedSchema(DATABASE_FILE);
    logger.info(`download-snapshot: wrote ${DATABASE_FILE_NAME} (${humanSize(DATABASE_FILE)})`);
  } catch (error) {
    await fs.promises.rm(DATABASE_FILE, { force: true });
    logger.warn(
      "download-snapshot: published SQLite snapshot unavailable or incompatible; building locally",
      error,
    );
    await buildDatabase(logger);
  }
}

function assertSupportedSchema(file: string): void {
  const db = new Database(file, { readonly: true });
  try {
    const row = db
      .prepare<[string], SchemaVersionRow>("SELECT value FROM metadata WHERE key = ?")
      .get("schema_version");
    const schemaVersion = Number(row?.value);
    if (schemaVersion !== DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `SQLite snapshot schema ${schemaVersion} is not supported; expected ${DATABASE_SCHEMA_VERSION}`,
      );
    }
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
  logger.error("download-snapshot: failed", err);
  process.exit(1);
});
