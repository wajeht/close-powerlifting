import cron from 'node-cron';

import logger from '../utils/logger';
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

export async function init() {
  logger.info(`**** cron services were started! ****`);

  // everyday at mid night
  cron.schedule('0 0 * * *', removeCaches).start();
}
