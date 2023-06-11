import app from './app';
import { PORT } from './config/constants';
import * as admin from './utils/admin-user';
import * as crons from './utils/crons';
import * as db from './utils/db';
import logger from './utils/logger';

app.listen(PORT, async () => {
  await db.init();
  await crons.init();
  await admin.init();

  logger.info(`**** app was started on http://localhost:${PORT} ****`);
});
