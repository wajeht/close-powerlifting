// Downloads the prebuilt SQLite snapshot from the `snapshot-latest`
// GitHub Release into src/data/snapshot/.

import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { DATABASE_FILE, DATABASE_FILE_NAME, SNAPSHOT_DIR } from "../src/data/database-files";
import { createLogger } from "../src/utils/logger";

const REPO = "wajeht/close-powerlifting";
const TAG = "snapshot-latest";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`download-snapshot: source ${BASE_URL}`);
  logger.info(`download-snapshot: fetching ${DATABASE_FILE_NAME}`);
  await downloadTo(`${BASE_URL}/${DATABASE_FILE_NAME}`, DATABASE_FILE);
  logger.info(`download-snapshot: wrote ${DATABASE_FILE_NAME} (${humanSize(DATABASE_FILE)})`);
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
