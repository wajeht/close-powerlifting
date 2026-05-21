// Downloads the prebuilt snapshot from the `snapshot-latest` GitHub
// Release into src/data/snapshot/. The file matches the layout produced
// by scripts/build-snapshot.ts and consumed by src/data/store.ts at boot.
//
// Run via `npm run snapshot:download` or `npx tsx scripts/download-snapshot.ts`.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { createLogger } from "../src/utils/logger";

const REPO = "wajeht/close-powerlifting";
const TAG = "snapshot-latest";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");

const SQLITE_FILE = "snapshot.sqlite";

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`download-snapshot: source ${BASE_URL}`);
  const sqliteDest = path.join(SNAPSHOT_DIR, SQLITE_FILE);
  logger.info(`download-snapshot: fetching ${SQLITE_FILE}`);
  await downloadTo(`${BASE_URL}/${SQLITE_FILE}`, sqliteDest);
  logger.info(`download-snapshot:   wrote ${SQLITE_FILE} (${humanSize(sqliteDest)})`);
  logger.info(`download-snapshot: done`);
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(dest));
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
