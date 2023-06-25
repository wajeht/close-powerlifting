import app from './app';
import { PORT } from './config/constants';
import * as admin from './utils/admin-user';
import * as crons from './utils/crons';
import * as db from './utils/db';
import logger from './utils/logger';
// @ts-ignore
import redis from './utils/redis';

const server = app.listen(PORT, async () => {
  try {
    await db.init();
    await crons.init();
    await admin.init();

    logger.info(`**** app was started on http://localhost:${PORT} ****`);
  } catch (error) {
    logger.error('**** An error occurred during server start ', error, ' ****');
    process.exit(1);
  }
});

function gracefulShutdown() {
  logger.info('**** Received kill signal, shutting down gracefully. ****');
  server.close(async () => {
    try {
      // @ts-ignore
      redis.disconnect();
      await db.stop();
      logger.info('**** Closed out remaining connections. ****');
      process.exit();
    } catch (err) {
      logger.error('**** Error during shutdown ', err, ' ****');
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('**** Could not close connections in time, forcefully shutting down ****');
    process.exit(1);
  }, 30 * 1000); // force shutdown after 30s
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('unhandledRejection', (reason, promise) => {
  logger.error('**** Unhandled Rejection at: ', promise, ' reason: ', reason, ' ****');
});
