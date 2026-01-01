import cron from "node-cron";

import { config } from "../config";
import { cache } from "../db/cache";
import {
  findVerified,
  findByApiCallCount,
  resetAllApiCallCounts,
} from "../db/repositories/user.repository";
import { logger } from "../utils/logger";
import { createReachingApiLimitHtml } from "../utils/templates/reaching-api-limit";
import { mail } from "./mail";
import { createApiLimitResetHtml } from "./templates/api-limits-reset";

async function removeCaches() {
  try {
    logger.info(`removeCaches() cron starts!`);

    const deleted = await cache.delPattern("close-powerlifting%");
    logger.info(`deleted ${deleted} cache entries!`);
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
      const users = await findVerified();

      await resetAllApiCallCounts();

      for (const user of users) {
        mail.sendMail({
          from: `"Close Powerlifting" <${config.email.user}>`,
          to: user.email,
          subject: "API Call Limit Reset",
          html: createApiLimitResetHtml({ name: user.name }),
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
    const targetCount = Math.floor(config.app.defaultApiCallLimit * 0.7);
    const users = await findByApiCallCount(targetCount);

    for (const user of users) {
      mail.sendMail({
        from: `"Close Powerlifting" <${config.email.user}>`,
        to: user.email,
        subject: "Reaching API Limit",
        html: createReachingApiLimitHtml({ name: user.name, percent: 70 }),
      });

      logger.info(`sendReachingApiLimitEmail() sent to user id ${user.id}`);
    }

    logger.info(`sendReachingApiLimitEmail() cron ends!`);
  } catch (error) {
    logger.error(`sendReachingApiLimitEmail() error: ${error}`);
  }
}

let isCronStarted = false;

export async function initCrons() {
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
