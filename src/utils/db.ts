import { MONGODB_URI } from '../config/constants';

import mongoose from 'mongoose';

/**
 * It connects to the database and logs a message if it succeeds
 */
export async function init() {
  try {
    await mongoose.connect(MONGODB_URI!);
    console.log('db connection started!');
  } catch (e) {
    console.log('db connection failed!');
    process.exit(1);
  }
}

/**
 * It returns a promise that resolves when the mongoose connection is closed
 * @returns The connection to the database is being closed.
 */
export function stop() {
  console.log('db stopped!');
  return mongoose.connection.close();
}
