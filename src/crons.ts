import cron, { ScheduledTask } from "node-cron";

import { config } from "./config";
import { Cache } from "./db/cache";
import { User } from "./db/user";
import { Logger } from "./utils/logger";
import { Mail } from "./mail";

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
}

export function Cron(): CronType {
  const cache = Cache();
  const userRepository = User();
  const logger = Logger();
  const mail = Mail();

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

      const users = await userRepository.findVerified();
      await userRepository.resetAllApiCallCounts();

      for (const user of users) {
        await mail.sendApiLimitResetEmail({ email: user.email, name: user.name });
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
      const users = await userRepository.findByApiCallCount(targetCount);

      for (const user of users) {
        await mail.sendReachingApiLimitEmail({
          email: user.email,
          name: user.name,
          percent: 70,
        });
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
