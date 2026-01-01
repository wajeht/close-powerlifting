import cron from "node-cron";

import { emailConfig } from "../config/constants";
import { DEFAULT_API_CALL_LIMIT } from "../config/constants";
import cache from "../db/cache";
import * as UserRepository from "../db/repositories/user.repository";
import logger from "../utils/logger";
import reachingApiLimitHTML from "../utils/templates/reaching-api-limit";
import mail from "./mail";
import apiLimitResetHTML from "./templates/api-limits-reset";

async function removeCaches() {
  try {
    logger.info(`removeCaches() cron starts!`);

    // Delete all cache entries matching the pattern
    const deleted = await cache.delPattern("close-powerlifting%");
    logger.info(`deleted ${deleted} cache entries!`);

    // Also clear expired cache entries
    await cache.clearExpired();

    logger.info(`removeCaches() cron ends!`);
  } catch (err) {
    logger.error(`removeCaches() error: ${err}`);
  }
}

async function resetApiCallCount() {
  try {
    logger.info(`resetApiCallCount() cron starts!`);

    const today = new Date();
    const isStartOfMonth = today.getDate() === 1;

    if (isStartOfMonth) {
      // Get users who have been verified, then reset counts
      const users = await UserRepository.findVerified();

      // Reset all api call counts at once
      await UserRepository.resetAllApiCallCounts();

      // Send emails to each user
      for (const user of users) {
        mail.sendMail({
          from: `"Close Powerlifting" <${emailConfig.auth_email}>`,
          to: user.email,
          subject: "API Call Limit Reset",
          html: apiLimitResetHTML({ name: user.name }),
        });

        logger.info(`resetApiCallCount() sent to user id ${user.id}`);
      }
    }

    logger.info(`resetApiCallCount() cron ends!`);
  } catch (err) {
    logger.error(`resetApiCallCount() error: ${err}`);
  }
}

async function sendReachingApiLimitEmail() {
  try {
    logger.info(`sendReachingApiLimitEmail() cron starts!`);

    // 70 % of default api call limit and verified users only
    const targetCount = Math.floor(DEFAULT_API_CALL_LIMIT * 0.7);
    const users = await UserRepository.findByApiCallCount(targetCount);

    for (const user of users) {
      mail.sendMail({
        from: `"Close Powerlifting" <${emailConfig.auth_email}>`,
        to: user.email,
        subject: "Reaching API Limit",
        html: reachingApiLimitHTML({ name: user.name, percent: 70 }),
      });

      logger.info(`sendReachingApiLimitEmail() sent to user id ${user.id}`);
    }

    logger.info(`sendReachingApiLimitEmail() cron ends!`);
  } catch (error) {
    logger.error(`sendReachingApiLimitEmail() error: ${error}`);
  }
}

let isCronStarted = false;

export async function init() {
  try {
    logger.info(`cron services were started!`);

    isCronStarted = true;

    // every week sunday at mid night
    cron.schedule("0 0 * * 0", removeCaches).start();

    // everyday at mid night
    cron.schedule("0 0 * * *", sendReachingApiLimitEmail).start();

    // everyday at mid night
    cron.schedule("0 0 * * *", resetApiCallCount).start();

    logger.info(`finished running all the cron services`);
  } catch (err) {
    isCronStarted = false;
    logger.error(`cron services error: ${err}`);
  }
}

export const isCronServiceStarted = () => isCronStarted;
