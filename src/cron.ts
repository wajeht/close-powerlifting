import cron, { ScheduledTask } from "node-cron";
import type { Knex } from "knex";

import { configuration } from "./configuration";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";
import type { IngestServiceType } from "./utils/ingest";
import {
  createHealthCheckService,
  HEALTH_CHECK_CACHE_KEY,
} from "./routes/api/health-check/health-check.service";
import { createMeetService } from "./routes/api/meets/meets.service";
import { createUserService } from "./routes/api/users/users.service";
import { createFederationService } from "./routes/api/federations/federations.service";
import { createRankingService } from "./routes/api/rankings/rankings.service";
import { createRecordService } from "./routes/api/records/records.service";
import { createStatusService } from "./routes/api/status/status.service";
import { HOSTNAME_CACHE_KEY } from "./routes/middleware";

const REFRESH_DELAY_MS = process.env.NODE_ENV === "testing" ? 0 : 2000;

export const INTERNAL_CACHE_KEYS = [HOSTNAME_CACHE_KEY, HEALTH_CHECK_CACHE_KEY];

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    refreshCache: () => Promise<void>;
    refreshCacheKey: (key: string) => Promise<void>;
    refreshHealthCheck: () => Promise<void>;
    runIngest: () => Promise<void>;
  };
}

interface RefreshResult {
  endpoint: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export function createCron(
  cache: CacheType,
  userRepository: UserRepositoryType,
  logger: LoggerType,
  scraper: ScraperType,
  ingest: IngestServiceType,
  knex: Knex,
): CronType {
  let cronJobs: ScheduledTask[] = [];
  let isRunning = false;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function refreshEndpoint(
    name: string,
    refreshFn: () => Promise<void>,
  ): Promise<RefreshResult> {
    const start = Date.now();
    try {
      logger.info(`refreshCache: refreshing ${name}`);
      await refreshFn();
      const durationMs = Date.now() - start;
      logger.info(`refreshCache: ${name} refreshed`, { durationMs });
      return { endpoint: name, success: true, durationMs };
    } catch (error) {
      const durationMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`refreshCache: failed to refresh ${name}`, { error: errorMessage });
      return { endpoint: name, success: false, error: errorMessage, durationMs };
    }
  }

  const meetService = createMeetService(knex);
  const userService = createUserService(knex);
  const federationService = createFederationService(knex);
  const rankingService = createRankingService(knex);
  const recordService = createRecordService(knex);
  const statusService = createStatusService(knex);
  const healthCheckService = createHealthCheckService(cache, scraper, logger);

  const refreshers = [
    statusService.refreshCacheKey,
    federationService.refreshCacheKey,
    meetService.refreshCacheKey,
    userService.refreshCacheKey,
    recordService.refreshCacheKey,
    rankingService.refreshCacheKey,
  ];

  async function refreshCacheKey(key: string): Promise<void> {
    for (const refresher of refreshers) {
      if (await refresher(key)) return;
    }
    logger.warn(`refreshCacheKey: unknown key type: ${key}`);
  }

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

  async function refreshCacheTask() {
    try {
      const startTime = Date.now();
      logger.info("cron job started: refreshCache");

      const allKeys = await cache.keys("%");
      const keysToRefresh = allKeys.filter((key) => !INTERNAL_CACHE_KEYS.includes(key));

      logger.info(`refreshCache: found ${keysToRefresh.length} keys to refresh`);

      const results: RefreshResult[] = [];

      for (const key of keysToRefresh) {
        results.push(await refreshEndpoint(key, () => refreshCacheKey(key)));
        await delay(REFRESH_DELAY_MS);
      }

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success);
      const totalDurationMs = Date.now() - startTime;

      logger.info("cron job completed: refreshCache", {
        total: results.length,
        successful,
        failed: failed.length,
        totalDurationMs,
        failedEndpoints: failed.map((f) => f.endpoint),
      });
    } catch (error) {
      logger.error("cron job failed: refreshCache", error);
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
    cronJobs.push(cron.schedule("0 4 * * 0", refreshCacheTask));
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
      refreshCache: refreshCacheTask,
      refreshCacheKey,
      refreshHealthCheck: refreshHealthCheckTask,
      runIngest: runIngestTask,
    },
  };
}
