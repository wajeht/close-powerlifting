// Cron service. One nightly job: download a fresh CSV. If the upstream
// last-modified header differs from our cached value, write the new zip
// over the cache and exit the process (`process.exit(0)`). Docker's
// `restart: unless-stopped` policy then brings the container back, and the
// boot path re-parses the freshly-downloaded file.
//
// This avoids the in-process rebuild headache (~5 GB of live + new heap
// during the swap) at the cost of ~60 s of unavailability per night.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import cron, { ScheduledTask } from "node-cron";

import type { LoggerType } from "./utils/logger";
import type { DataStoreType } from "./data/store";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const CSV_CACHE_DIR =
  process.env.OPL_CACHE_DIR ?? path.join(os.tmpdir(), "close-powerlifting-cache");
const CSV_CACHE_FILE = path.join(CSV_CACHE_DIR, "openpowerlifting-latest.zip");
const CSV_CACHE_META = path.join(CSV_CACHE_DIR, "last-modified.txt");

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    refresh: () => Promise<void>;
  };
}

export function createCron(logger: LoggerType, _store: DataStoreType): CronType {
  let cronJobs: ScheduledTask[] = [];
  let isRunning = false;

  async function refreshTask(): Promise<void> {
    try {
      logger.info("cron: refresh started");

      const head = await fetch(DOWNLOAD_URL, { method: "HEAD" });
      if (!head.ok) {
        logger.warn(`cron: HEAD ${DOWNLOAD_URL} returned ${head.status}; skipping refresh`);
        return;
      }
      const upstream = head.headers.get("last-modified");
      const cached = await readCachedLastModified();
      if (upstream != null && upstream === cached) {
        logger.info(`cron: upstream unchanged (last-modified=${upstream}); nothing to do`);
        return;
      }

      logger.info(`cron: downloading fresh CSV (upstream last-modified=${upstream ?? "unknown"})`);
      const response = await fetch(DOWNLOAD_URL);
      if (!response.ok || response.body == null) {
        logger.warn(`cron: download failed (${response.status}); skipping`);
        return;
      }

      await fs.promises.mkdir(CSV_CACHE_DIR, { recursive: true });
      await pipeline(
        Readable.fromWeb(response.body as never),
        fs.createWriteStream(CSV_CACHE_FILE),
      );
      if (upstream != null) {
        await fs.promises.writeFile(CSV_CACHE_META, upstream, "utf8");
      }

      logger.info(
        "cron: fresh CSV cached; exiting process so orchestrator restarts us with the new data",
      );
      // Brief delay so the log line flushes before we exit.
      setTimeout(() => process.exit(0), 250).unref();
    } catch (error) {
      logger.error("cron: refresh failed", error);
    }
  }

  function start(): void {
    // 04:00 UTC — after OpenPowerlifting's nightly publish, before US-morning traffic.
    cronJobs.push(cron.schedule("0 4 * * *", refreshTask));
    isRunning = true;
    logger.info("cron service started", { jobs: cronJobs.length });
  }

  function stop(): void {
    for (const job of cronJobs) {
      void job.stop();
    }
    cronJobs = [];
    isRunning = false;
    logger.info("cron service stopped");
  }

  function getStatus(): { isRunning: boolean; jobCount: number } {
    return { isRunning, jobCount: cronJobs.length };
  }

  return {
    start,
    stop,
    getStatus,
    tasks: { refresh: refreshTask },
  };
}

async function readCachedLastModified(): Promise<string | null> {
  try {
    const text = await fs.promises.readFile(CSV_CACHE_META, "utf8");
    return text.trim() || null;
  } catch {
    return null;
  }
}
