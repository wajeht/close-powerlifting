import Redis from 'ioredis';

import { REDIS } from '../config/constants';
import logger from './logger';

let redis;

try {
  // @ts-ignore
  redis = new Redis({
    host: REDIS.HOST,
    port: REDIS.PORT,
    username: REDIS.USERNAME,
    password: REDIS.PASSWORD,
    db: REDIS.DATABASE,
  });

  logger.info(`**** redis client started! ****`);
} catch (e) {
  logger.info(`**** redis client failed! ****`);
}

export default redis;
