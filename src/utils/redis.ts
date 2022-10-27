import Redis from 'ioredis';
import { REDIS } from '../config/constants';

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

  console.log(`redis client started!`);
} catch (e) {
  console.log(`redis client failed!`);
}

export default redis;
