import cron, { ScheduledTask } from "node-cron";

import { configuration } from "./configuration";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { LoggerType } from "./utils/logger";
import type { IngestServiceType } from "./utils/ingest";
import { createHealthCheckService } from "./routes/api/health-check/health-check.service";
import { HOSTNAME_CACHE_KEY } from "./routes/middleware";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    refreshHealthCheck: () => Promise<void>;
    runIngest: () => Promise<void>;
  };
}

export function createCron(
  cache: CacheType,
  userRepository: UserRepositoryType,
  logger: LoggerType,
  ingest: IngestServiceType,
): CronType {
  let cronJobs: ScheduledTask[] = [];
  let isRunning = false;

  const healthCheckService = createHealthCheckService(cache, logger);

  async function refreshHealthCheckTask() {
    try {
      logger.info("cron job started: refreshHealthCheck");

      const hostname = await cache.get(HOSTNAME_CACHE_KEY);
      if (!hostname) {
        logger.warn("refreshHealthCheck: hostname not cached yet, skipping");
        return;
      }

      const adminUser = await userRepository.findByEmail(configuration.app.adminEmail);
      if (!adminUser?.api_key) {
        logger.warn("refreshHealthCheck: admin user or API key not found, skipping");
        return;
      }

      await healthCheckService.refreshAPIStatus({ apiKey: adminUser.api_key, url: hostname });

      logger.info("cron job completed: refreshHealthCheck");
    } catch (error) {
      logger.error("cron job failed: refreshHealthCheck", error);
    }
  }

  async function runIngestTask() {
    try {
      logger.info("cron job started: runIngest");
      const result = await ingest.runNightly();
      logger.info(
        `cron job completed: runIngest (status=${result.status}, lifts=${result.stats.lifts}, durationMs=${result.durationMs})`,
      );
    } catch (error) {
      logger.error("cron job failed: runIngest", error);
    }
  }

  function start(): void {
    cronJobs.push(cron.schedule("0 5 * * *", refreshHealthCheckTask));
    cronJobs.push(cron.schedule("0 4 * * *", runIngestTask));

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
    tasks: {
      refreshHealthCheck: refreshHealthCheckTask,
      runIngest: runIngestTask,
    },
  };
}
