// Downloads the prebuilt snapshot from the `snapshot-latest` GitHub
// Release into src/data/snapshot/. The files match the layout produced
// by scripts/build-snapshot.ts and consumed by src/data/store.ts at boot.
//
// Streams each response body directly to disk via pipeline +
// Readable.fromWeb so the ~700 MB entries.json never lands in memory.
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

const REQUIRED_FILES = ["lifters.json", "meets.json", "entries.json", "meta.json"] as const;
const RUNTIME_INDEX_FILES = ["runtime-indexes.json", "runtime-indexes.bin"] as const;

const logger = createLogger();

async function main(): Promise<void> {
  await fs.promises.mkdir(SNAPSHOT_DIR, { recursive: true });

  logger.info(`download-snapshot: source ${BASE_URL}`);
  for (const name of REQUIRED_FILES) {
    const dest = path.join(SNAPSHOT_DIR, name);
    logger.info(`download-snapshot: fetching ${name}`);
    await downloadTo(`${BASE_URL}/${name}`, dest);
    logger.info(`download-snapshot:   wrote ${name} (${humanSize(dest)})`);
  }
  try {
    for (const name of RUNTIME_INDEX_FILES) {
      const dest = path.join(SNAPSHOT_DIR, name);
      logger.info(`download-snapshot: fetching ${name}`);
      await downloadTo(`${BASE_URL}/${name}`, dest);
      logger.info(`download-snapshot:   wrote ${name} (${humanSize(dest)})`);
    }
  } catch (error) {
    for (const name of RUNTIME_INDEX_FILES) {
      await fs.promises.rm(path.join(SNAPSHOT_DIR, name), { force: true });
    }
    logger.warn("download-snapshot: runtime indexes unavailable; startup will rebuild them", error);
  }

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
