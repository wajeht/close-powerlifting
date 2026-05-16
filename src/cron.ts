import cron, { ScheduledTask } from "node-cron";
import type { Knex } from "knex";

import { configuration } from "./configuration";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { ApiCallLogRepositoryType } from "./db/api-call-log";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";
import type { IngestServiceType } from "./utils/ingest";
import { createHealthCheckService } from "./routes/api/health-check/health-check.service";
import { createMeetService } from "./routes/api/meets/meets.service";
import { createUserService } from "./routes/api/users/users.service";
import { createFederationService } from "./routes/api/federations/federations.service";
import { createRankingService } from "./routes/api/rankings/rankings.service";
import { createRecordService } from "./routes/api/records/records.service";
import { createStatusService } from "./routes/api/status/status.service";

const REFRESH_DELAY_MS = process.env.NODE_ENV === "testing" ? 0 : 2000;

const API_CALL_RESET_MONTH_KEY = "api-call-count-last-reset-month";

export const INTERNAL_CACHE_KEYS = [
  "hostname",
  "close-powerlifting-global-status-call-cache",
  API_CALL_RESET_MONTH_KEY,
];

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    refreshCache: () => Promise<void>;
    refreshCacheKey: (key: string) => Promise<void>;
    refreshHealthCheck: () => Promise<void>;
    resetApiCallCount: () => Promise<void>;
    sendReachingApiLimitEmail: () => Promise<void>;
    cleanupOldApiCallLogs: () => Promise<void>;
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
  mail: MailType,
  logger: LoggerType,
  scraper: ScraperType,
  apiCallLogRepository: ApiCallLogRepositoryType,
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

  const meetService = createMeetService(scraper);
  const userService = createUserService(knex, scraper);
  const federationService = createFederationService(scraper);
  const rankingService = createRankingService(scraper);
  const recordService = createRecordService(scraper);
  const statusService = createStatusService(scraper);
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

      const hostname = await cache.get("hostname");
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

      // Summary
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

  async function resetApiCallCountTask() {
    try {
      logger.info("cron job started: resetApiCallCount");

      const now = new Date();
      const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

      const lastResetMonth = await cache.get(API_CALL_RESET_MONTH_KEY);
      if (lastResetMonth === currentMonth) {
        logger.info("cron job skipped: resetApiCallCount (already reset this month)", {
          currentMonth,
        });
        return;
      }

      const users = await userRepository.findVerifiedWithUsage();
      await userRepository.resetAllApiCallCounts();
      await cache.set(API_CALL_RESET_MONTH_KEY, currentMonth);

      const results = await Promise.allSettled(
        users.map((user) => mail.sendApiLimitResetEmail({ email: user.email, name: user.name })),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        logger.warn(`resetApiCallCount: ${failed.length}/${users.length} emails failed to send`);
      }

      logger.info("cron job completed: resetApiCallCount");
    } catch (error) {
      logger.error("cron job failed: resetApiCallCount", error);
    }
  }

  async function sendReachingApiLimitEmailTask() {
    try {
      logger.info("cron job started: sendReachingApiLimitEmail");

      const targetCount = Math.floor(configuration.app.defaultApiCallLimit * 0.7);
      const users = await userRepository.findByApiCallCount(targetCount);

      const results = await Promise.allSettled(
        users.map((user) =>
          mail.sendReachingApiLimitEmail({
            email: user.email,
            name: user.name,
            percent: 70,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        logger.warn(
          `sendReachingApiLimitEmail: ${failed.length}/${users.length} emails failed to send`,
        );
      }

      logger.info("cron job completed: sendReachingApiLimitEmail");
    } catch (error) {
      logger.error("cron job failed: sendReachingApiLimitEmail", error);
    }
  }

  async function runIngestTask() {
    try {
      logger.info("cron job started: runIngest");
      const result = await ingest.runNightly();
      logger.info(
        `cron job completed: runIngest (status=${result.status}, rows=${result.rowCount}, durationMs=${result.durationMs})`,
      );
    } catch (error) {
      logger.error("cron job failed: runIngest", error);
    }
  }

  async function cleanupOldApiCallLogsTask() {
    try {
      logger.info("cron job started: cleanupOldApiCallLogs");

      const retentionDays = configuration.app.apiCallLogRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await apiCallLogRepository.deleteOlderThan(cutoffDate);

      if (deletedCount > 0) {
        logger.info(`cron job completed: cleanupOldApiCallLogs - deleted ${deletedCount} logs`);
      } else {
        logger.info("cron job completed: cleanupOldApiCallLogs - no logs to delete");
      }
    } catch (error) {
      logger.error("cron job failed: cleanupOldApiCallLogs", error);
    }
  }

  function start(): void {
    cronJobs.push(cron.schedule("0 4 * * 0", refreshCacheTask)); // Weekly cache refresh: Sundays at 4:00 AM UTC
    cronJobs.push(cron.schedule("0 5 * * *", refreshHealthCheckTask)); // Daily health check refresh: every day at 5:00 AM UTC
    cronJobs.push(cron.schedule("0 0 * * *", sendReachingApiLimitEmailTask)); // Daily email notification: every day at 12:00 AM UTC
    cronJobs.push(cron.schedule("5 0 * * *", resetApiCallCountTask)); // Daily 12:05 AM check (server local time); resets once per UTC month — see API_CALL_RESET_MONTH_KEY guard. Self-heals if a firing is missed.
    cronJobs.push(cron.schedule("0 3 * * *", cleanupOldApiCallLogsTask)); // Daily API call log cleanup: every day at 3:00 AM UTC
    cronJobs.push(cron.schedule("0 4 * * *", runIngestTask)); // Daily OpenPowerlifting CSV ingest: every day at 4:00 AM UTC

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
      resetApiCallCount: resetApiCallCountTask,
      sendReachingApiLimitEmail: sendReachingApiLimitEmailTask,
      cleanupOldApiCallLogs: cleanupOldApiCallLogsTask,
      runIngest: runIngestTask,
    },
  };
}
