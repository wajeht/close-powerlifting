// Cron service. One nightly job: download the OpenPowerlifting CSV and
// either reload the in-memory store in-process, or trigger a clean
// container restart so the boot path re-parses the freshly-downloaded file.
// Strategy is chosen by the loader (see src/data/loader.ts); the cron
// just kicks it.

import cron, { ScheduledTask } from "node-cron";

import type { LoggerType } from "./utils/logger";
import type { DataStoreType } from "./data/store";

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
      logger.info("cron job started: refresh");
      // TODO (phase 4): wire to loader.refresh() once it exists.
      logger.info("cron job completed: refresh (no-op until loader is wired)");
    } catch (error) {
      logger.error("cron job failed: refresh", error);
    }
  }

  function start(): void {
    // 04:00 UTC — after OpenPowerlifting's nightly publish, before US-morning
    // traffic. Same slot as the previous SQLite-backed ingest used.
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
