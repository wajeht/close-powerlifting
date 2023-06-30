import cron from 'node-cron';

import { EMAIL } from '../config/constants';
import { DEFAULT_API_CALL_LIMIT } from '../utils/enums';
import logger from '../utils/logger';
import reachingApiLimitHTML from '../utils/templates/reaching-api-limit';
import { User } from '../views/views.models';
import mail from './mail';
// @ts-ignore
import redis from './redis';
import apiLimitResetHTML from './templates/api-limits-reset';

function removeCaches() {
  try {
    logger.info(` **** removeCaches() cron starts! ****`);

    // @ts-ignore
    redis.keys('*', function (err, keys) {
      if (err) return null;
      keys.forEach((key: any) => {
        if (key.match(/close-powerlifting.+/g)) {
          logger.info(`deleted redis cache ${key}!`);
          // @ts-ignore
          redis.del(key);
        }
      });
    });

    logger.info(` **** removeCaches() cron ends! ****`);
  } catch (err) {
    logger.error(`removeCaches() error: ${err}`);
  }
}

async function resetApiCallCount() {
  try {
    logger.info(` **** resetApiCallCount() cron starts! ****`);

    const today = new Date();
    const isStartOfMonth = today.getDate() === 1;

    if (isStartOfMonth) {
      // users who has been verified only
      const users = await User.find({ verified: true });

      users.forEach((user) => {
        user.api_call_count = 0;
        user.save();

        mail.sendMail({
          from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
          to: user.email,
          subject: 'API Call Limit Reset',
          html: apiLimitResetHTML({ name: user.name! }),
        });

        logger.info(` **** resetApiCallCount() sent to user id ${user.id} ****`);
      });
    }

    logger.info(` **** resetApiCallCount() cron starts! ****`);
  } catch (err) {
    logger.error(`resetApiCallCount() error: ${err}`);
  }
}

async function sendReachingApiLimitEmail() {
  try {
    logger.info(` **** sendReachingApiLimitEmail() cron starts! ****`);

    // 70 % of default api call limit and verified users only
    const users = await User.find({
      api_call_count: { $gte: DEFAULT_API_CALL_LIMIT * 0.7 },
      verified: true,
    });

    users.forEach((user) => {
      mail.sendMail({
        from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
        to: user.email,
        subject: 'Reaching API Limit',
        html: reachingApiLimitHTML({ name: user.name! }),
      });

      logger.info(` **** sendReachingApiLimitEmail() sent to user id ${user.id} ****`);
    });

    logger.info(` **** sendReachingApiLimitEmail() cron ends! ****`);
  } catch (error) {
    logger.error(`sendReachingApiLimitEmail() error: ${error}`);
  }
}

export async function init() {
  logger.info(`**** cron services were started! ****`);

  // every week sunday at mid night
  cron.schedule('0 0 * * 0', removeCaches).start();

  // everyday at mid night
  cron.schedule('0 0 * * *', sendReachingApiLimitEmail).start();

  // everyday at mid night
  cron.schedule('0 0 * * *', resetApiCallCount).start();

  logger.info(`**** finished running all the cron services ****`);
}
