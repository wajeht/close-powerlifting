import cron from 'node-cron';

import { EMAIL } from '../config/constants';
import logger from '../utils/logger';
import reachingApiLimitHTML from '../utils/templates/reaching-api-limit';
import { User } from '../views/views.models';
import mail from './mail';
// @ts-ignore
import redis from './redis';

function removeCaches() {
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
}

async function sendReachingApiLimitEmail() {
  logger.info(` **** sendReachingApiLimitEmail() cron starts! ****`);

  const users = await User.find({ api_limit: 70 });

  users.forEach((user) => {
    mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: user.email,
      subject: 'Reaching API Limit',
      html: reachingApiLimitHTML({ name: user.name! }),
    });
  });

  logger.info(` **** sendReachingApiLimitEmail() cron ends! ****`);
}

export async function init() {
  logger.info(`**** cron services were started! ****`);

  // everyday at mid night
  cron.schedule('0 0 * * *', removeCaches).start();

  // everyday at mid night
  cron.schedule('0 0 * * *', sendReachingApiLimitEmail).start();

  logger.info(`**** finished running all the cron services ****`);
}
