import cron, { ScheduledTask } from "node-cron";

import { config } from "./config";
import { cache } from "./db/cache";
import {
  findVerified,
  findByApiCallCount,
  resetAllApiCallCounts,
} from "./db/repositories/user.repository";
import { logger } from "./utils/logger";
import { createReachingApiLimitText } from "./utils/templates/reaching-api-limit";
import { createApiLimitResetText } from "./utils/templates/api-limits-reset";
import { mail } from "./utils/mail";

export interface CronService {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
}

export function createCronService(): CronService {
  let cronJobs: ScheduledTask[] = [];
  let isRunning = false;

  async function removeCachesTask() {
    try {
      logger.info("cron job started: removeCaches");
      const deleted = await cache.delPattern("close-powerlifting%");
      logger.info(`deleted ${deleted} cache entries`);
      await cache.clearExpired();
      logger.info("cron job completed: removeCaches");
    } catch (error) {
      logger.error("cron job failed: removeCaches", error);
    }
  }

  async function resetApiCallCountTask() {
    try {
      logger.info("cron job started: resetApiCallCount");

      const today = new Date();
      if (today.getDate() !== 1) {
        logger.info("cron job skipped: resetApiCallCount (not start of month)");
        return;
      }

      const users = await findVerified();
      await resetAllApiCallCounts();

      for (const user of users) {
        mail.sendMail({
          from: `"Close Powerlifting" <${config.email.user}>`,
          to: user.email,
          subject: "API Call Limit Reset",
          text: createApiLimitResetText({ name: user.name }),
        });
        logger.info(`resetApiCallCount email sent to user ${user.id}`);
      }

      logger.info("cron job completed: resetApiCallCount");
    } catch (error) {
      logger.error("cron job failed: resetApiCallCount", error);
    }
  }

  async function sendReachingApiLimitEmailTask() {
    try {
      logger.info("cron job started: sendReachingApiLimitEmail");

      const targetCount = Math.floor(config.app.defaultApiCallLimit * 0.7);
      const users = await findByApiCallCount(targetCount);

      for (const user of users) {
        mail.sendMail({
          from: `"Close Powerlifting" <${config.email.user}>`,
          to: user.email,
          subject: "Reaching API Limit",
          text: createReachingApiLimitText({ name: user.name, percent: 70 }),
        });
        logger.info(`reachingApiLimit email sent to user ${user.id}`);
      }

      logger.info("cron job completed: sendReachingApiLimitEmail");
    } catch (error) {
      logger.error("cron job failed: sendReachingApiLimitEmail", error);
    }
  }

  function start(): void {
    cronJobs.push(cron.schedule("0 0 * * 0", removeCachesTask));
    cronJobs.push(cron.schedule("0 0 * * *", sendReachingApiLimitEmailTask));
    cronJobs.push(cron.schedule("0 0 * * *", resetApiCallCountTask));

    isRunning = true;
    logger.info("cron service started", { jobs: cronJobs.length });
  }

  function stop(): void {
    cronJobs.forEach((job) => job.stop());
    cronJobs = [];
    isRunning = false;
    logger.info("cron service stopped");
  }

  function getStatus(): { isRunning: boolean; jobCount: number } {
    return { isRunning, jobCount: cronJobs.length };
  }

  return { start, stop, getStatus };
}

export const cronService = createCronService();
