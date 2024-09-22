import mongoose from 'mongoose';

import { databaseConfig } from '../config/constants';

import logger from '../utils/logger';

export async function init() {
  try {
    await mongoose.connect(databaseConfig.mongodb_uri);
    logger.info('db connection started!');
  } catch (e) {
    logger.error('db connection failed!');
    console.log(e);
    process.exit(1);
  }
}

export function stop() {
  logger.info('db connection stopped!');
  return mongoose.connection.close();
}
