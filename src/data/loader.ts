// CSV loader. Downloads OPL's nightly zip, streams the CSV through
// csv-parse, builds the in-memory AppData, and stores it in the data
// store. Designed to run once at boot — there's no cron-triggered refresh
// here yet (phase 4 will add the self-restart wiring).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, type Transform } from "node:stream";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import type { LoggerType } from "../utils/logger";
import type { DataStoreType } from "./store";
import type { AppData, Entry, Lifter, Meet } from "./types";
import { buildColumnIndex, normalizeRow, type ColumnIndex } from "./normalize";
import {
  buildBestEntryByLifter,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
} from "./indexes";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";

// On-disk cache for the most recent zip. Surviving a restart without
// re-downloading takes ~50 s off the boot path.
const CSV_CACHE_DIR =
  process.env.OPL_CACHE_DIR ?? path.join(os.tmpdir(), "close-powerlifting-cache");
const CSV_CACHE_FILE = path.join(CSV_CACHE_DIR, "openpowerlifting-latest.zip");
const CSV_CACHE_META = path.join(CSV_CACHE_DIR, "last-modified.txt");

export interface LoaderOptions {
  // Skip the network and use whatever's on disk if present. Useful for tests.
  preferCache?: boolean;
  // Force a fresh download even if the cached file is recent.
  force?: boolean;
}

export interface LoaderResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
  rowsSkipped: number;
}

export interface LoaderType {
  // Run the full pipeline: download (or read cache) → parse → build →
  // setAppData. Resolves once the in-memory store is populated and the
  // server is safe to start serving traffic.
  loadInitial: (options?: LoaderOptions) => Promise<LoaderResult>;
}

export function createLoader(logger: LoggerType, store: DataStoreType): LoaderType {
  async function loadInitial(options: LoaderOptions = {}): Promise<LoaderResult> {
    const startedAt = Date.now();
    const { zipPath, sourceLastModified } = await acquireZip(logger, options);
    const csvEntryName = await findCsvEntryName(zipPath);

    logger.info(`csv: parsing ${path.basename(zipPath)} (entry=${csvEntryName})`);
    const { built, rowsSkipped } = await parseAndBuild(
      zipPath,
      csvEntryName,
      sourceLastModified,
      logger,
    );

    store.set(built);

    return {
      durationMs: Date.now() - startedAt,
      sourceLastModified,
      rowCount: built.rowCount,
      rowsSkipped,
    };
  }

  return { loadInitial };
}

// --- network + cache ---

async function acquireZip(
  logger: LoggerType,
  options: LoaderOptions,
): Promise<{ zipPath: string; sourceLastModified: string | null }> {
  await fs.promises.mkdir(CSV_CACHE_DIR, { recursive: true });

  if (options.preferCache && fs.existsSync(CSV_CACHE_FILE)) {
    const cachedLastModified = await readCachedLastModified();
    logger.info(`csv: using cached zip (last-modified=${cachedLastModified ?? "unknown"})`);
    return { zipPath: CSV_CACHE_FILE, sourceLastModified: cachedLastModified };
  }

  // Try a HEAD request first to compare Last-Modified against the cache.
  // If it matches, skip the download.
  if (!options.force && fs.existsSync(CSV_CACHE_FILE)) {
    const cachedLastModified = await readCachedLastModified();
    if (cachedLastModified != null) {
      try {
        const head = await fetch(DOWNLOAD_URL, { method: "HEAD" });
        const upstream = head.headers.get("last-modified");
        if (head.ok && upstream === cachedLastModified) {
          logger.info(`csv: upstream unchanged (last-modified=${upstream}), using cached zip`);
          return { zipPath: CSV_CACHE_FILE, sourceLastModified: upstream };
        }
      } catch (error) {
        logger.warn("csv: HEAD request failed, will fall back to cached zip if present", {
          error: error instanceof Error ? error.message : String(error),
        });
        return { zipPath: CSV_CACHE_FILE, sourceLastModified: cachedLastModified };
      }
    }
  }

  logger.info(`csv: downloading ${DOWNLOAD_URL}`);
  const response = await fetch(DOWNLOAD_URL);
  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download OPL CSV: HTTP ${response.status}`);
  }
  const sourceLastModified = response.headers.get("last-modified");

  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(CSV_CACHE_FILE));
  if (sourceLastModified != null) {
    await fs.promises.writeFile(CSV_CACHE_META, sourceLastModified, "utf8");
  }
  const stat = await fs.promises.stat(CSV_CACHE_FILE);
  logger.info(`csv: downloaded ${(stat.size / 1024 / 1024).toFixed(1)} MB`);

  return { zipPath: CSV_CACHE_FILE, sourceLastModified };
}

async function readCachedLastModified(): Promise<string | null> {
  try {
    const text = await fs.promises.readFile(CSV_CACHE_META, "utf8");
    return text.trim() || null;
  } catch {
    return null;
  }
}

async function findCsvEntryName(zipPath: string): Promise<string> {
  const directory = await unzipper.Open.file(zipPath);
  const csvEntry = directory.files.find(
    (file) => file.path.endsWith(".csv") && file.type === "File",
  );
  if (csvEntry == null) throw new Error("Zip archive contains no CSV file");
  return csvEntry.path;
}

// Returns a fresh Readable over the CSV inside the zip. unzipper opens the
// archive lazily; we pause/resume the inner stream as the parser drains.
function openCsvStream(zipPath: string, entryName: string): Readable {
  const proxy = new Readable({ read: () => {} });

  void (async () => {
    try {
      const directory = await unzipper.Open.file(zipPath);
      const entry = directory.files.find((f) => f.path === entryName);
      if (entry == null) throw new Error(`CSV entry "${entryName}" not found in zip`);
      const stream = entry.stream();
      stream.on("data", (chunk) => {
        if (!proxy.push(chunk)) stream.pause();
      });
      stream.on("end", () => proxy.push(null));
      stream.on("error", (err) => proxy.destroy(err));
      proxy.on("drain", () => stream.resume());
    } catch (error) {
      proxy.destroy(error as Error);
    }
  })();

  return proxy;
}

// csv-parse with `columns: false` emits string[] per row instead of objects.
// Saves a fresh object allocation per row of the 3.9M-row stream.
function createCsvParser(): Transform {
  return parseCsv({ columns: false, skip_empty_lines: true, relax_column_count: true });
}

// --- parse + build ---

async function parseAndBuild(
  zipPath: string,
  csvEntryName: string,
  sourceLastModified: string | null,
  logger: LoggerType,
): Promise<{ built: AppData; rowsSkipped: number }> {
  const lifters: Lifter[] = [];
  const meets: Meet[] = [];
  const entries: Entry[] = [];

  const lifterByUsername = new Map<string, number>();
  const meetByPath = new Map<string, number>();

  let columnIndex: ColumnIndex | null = null;
  let rowIdx = 0;
  let rowsSkipped = 0;

  const stream = openCsvStream(zipPath, csvEntryName);

  await pipeline(stream, createCsvParser(), async function (source: AsyncIterable<string[]>) {
    for await (const row of source) {
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

      // Dedupe lifter.
      let lifterId = lifterByUsername.get(normalized.lifterUsername);
      if (lifterId == null) {
        lifterId = lifters.length;
        lifters.push({ username: normalized.lifterUsername, name: normalized.lifterName });
        lifterByUsername.set(normalized.lifterUsername, lifterId);
      }

      // Dedupe meet.
      let meetId = meetByPath.get(normalized.meetPath);
      if (meetId == null) {
        meetId = meets.length;
        meets.push(normalized.meet);
        meetByPath.set(normalized.meetPath, meetId);
      }

      entries.push({ ...normalized.entry, lifterId, meetId });
    }
  });

  // Indexes.
  const entriesByLifter = buildEntriesByLifter(entries);
  const entriesByMeet = buildEntriesByMeet(entries);
  const bestEntryByLifter = buildBestEntryByLifter(entries, lifters.length, entriesByLifter);
  const rankByMetric = buildRankByMetric(entries, lifters.length, bestEntryByLifter);
  const records = buildRecords(entries);
  const { federations, meetsByFederation } = buildFederations(meets);

  if (rowsSkipped > 0) {
    logger.warn(`loader: skipped ${rowsSkipped} malformed rows`);
  }

  const built: AppData = {
    lifters,
    meets,
    entries,
    lifterByUsername,
    meetByPath,
    entriesByLifter,
    entriesByMeet,
    bestEntryByLifter,
    rankByMetric,
    records,
    federations,
    meetsByFederation,
    sourceLastModified,
    ingestedAt: new Date().toISOString(),
    rowCount: entries.length,
  };
  return { built, rowsSkipped };
}
