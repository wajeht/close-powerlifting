import app from './app';
import { appConfig } from './config/constants';
import * as admin from './utils/admin-user';
import * as crons from './utils/crons';
import { AddressInfo } from 'net';
import * as db from './utils/db';
import { Server } from 'http';

import logger from './utils/logger';
import redis from './utils/redis';

const server: Server = app.listen(appConfig.port);

server.on('listening', async () => {
  const addr: string | AddressInfo | null = server.address();
  const bind: string =
    typeof addr === 'string' ? 'pipe ' + addr : 'port ' + (addr as AddressInfo).port;

  logger.info(`Server is listening on ${bind}`);

  try {
    await db.init();
    await crons.init();
    await admin.init();
  } catch (error) {
    logger.error((error as any).message);
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind: string =
    typeof appConfig.port === 'string' ? 'Pipe ' + appConfig.port : 'Port ' + appConfig.port;

  switch (error.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
    // eslint-disable-next-line no-fallthrough
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
    // eslint-disable-next-line no-fallthrough
    default:
      throw error;
  }
});

function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully.`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      redis.quit();
      logger.info('Redis connection closed.');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }

    try {
      db.stop();
      logger.info('mongo connection closed.');
    } catch (error) {
      logger.error('Error closing mongo connection:', error);
    }

    logger.info('All connections closed successfully.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('uncaughtException', async (error: Error, origin: string) => {
  logger.error('Uncaught Exception:', error, 'Origin:', origin);
  gracefulShutdown('uncaughtException');
});

process.on('warning', (warning: Error) => {
  logger.warn('Process warning:', warning.name, warning.message);
});

process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});
