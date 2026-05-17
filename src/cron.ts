// Cron service stub. The runtime no longer downloads data — the OPL
// snapshot is rebuilt by the weekly GitHub Actions workflow
// (`.github/workflows/update-data.yml`) and baked into the image. Kept as
// a no-op shell so the rest of AppContext doesn't need to know.

import type { LoggerType } from "./utils/logger";
import type { DataStoreType } from "./data/store";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
}

export function createCron(logger: LoggerType, _store: DataStoreType): CronType {
  function start(): void {
    logger.info("cron service: no jobs scheduled (data refresh is workflow-driven)");
  }

  function stop(): void {
    // no-op
  }

  function getStatus(): { isRunning: boolean; jobCount: number } {
    return { isRunning: true, jobCount: 0 };
  }

  return { start, stop, getStatus };
}
