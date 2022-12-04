import { MONGODB_URI } from '../config/constants';
import logger from '../utils/logger';

import mongoose from 'mongoose';

/**
 * It connects to the database and logs a message if it succeeds
 */
export async function init() {
  try {
    await mongoose.connect(MONGODB_URI!);
    logger.info('db connection started!');
  } catch (e) {
    logger.error('db connection failed!');
    console.log(e);
    process.exit(1);
  }
}

/**
 * It returns a promise that resolves when the mongoose connection is closed
 * @returns The connection to the database is being closed.
 */
export function stop() {
  logger.info('db connection stopped!');
  return mongoose.connection.close();
}
