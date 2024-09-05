import Redis from 'ioredis';

import { redisConfig } from '../config/constants';
import logger from './logger';

const redisOptions = {
  port: redisConfig.PORT,
  host: redisConfig.HOST,
  password: redisConfig.PASSWORD,
  maxRetriesPerRequest: null,
  family: 0, // Support both IPv6 and IPv4
};

const createRedisClient = () => {
  return new Redis(redisOptions);
};

const redis = createRedisClient();

redis.on('ready', () => {
  logger.error('Redis connection established successfully');
});

redis.on('error', (error) => {
  logger.error('Error initializing Redis:', error);
  process.exit(1);
});

export default redis;
