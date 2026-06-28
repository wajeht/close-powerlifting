// Downloads the prebuilt SQLite snapshot from the `snapshot-latest`
// GitHub Release into src/data/snapshot/.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { createLogger } from "../src/utils/logger";

const REPO = "wajeht/close-powerlifting";
const TAG = "snapshot-latest";
const FILE_NAME = "close-powerlifting.sqlite";
const BASE_URL = `https://github.com/${REPO}/releases/download/${TAG}`;
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "snapshot");

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  const dest = path.join(SNAPSHOT_DIR, FILE_NAME);
  logger.info(`download-snapshot: source ${BASE_URL}`);
  logger.info(`download-snapshot: fetching ${FILE_NAME}`);
  await downloadTo(`${BASE_URL}/${FILE_NAME}`, dest);
  logger.info(`download-snapshot: wrote ${FILE_NAME} (${humanSize(dest)})`);
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
