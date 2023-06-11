import { MONGODB_URI } from '../config/constants';

import logger from '../utils/logger';
import mongoose from 'mongoose';

export async function init() {
  try {
    await mongoose.connect(MONGODB_URI!);
    logger.info('**** db connection started! ****');
  } catch (e) {
    logger.error('**** db connection failed! ****');
    console.log(e);
    process.exit(1);
  }
}

export function stop() {
  logger.info('**** db connection stopped! ****');
  return mongoose.connection.close();
}
