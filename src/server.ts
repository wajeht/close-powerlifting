import * as db from './utils/db';
import * as crons from './utils/crons';
import * as admin from './utils/admin-user'
import app from './app';
import { PORT } from './config/constants';
import logger from './utils/logger';

app.listen(PORT, async () => {
  await db.init();
  await crons.init();
  await admin.init();

  logger.info(`**** app was started on http://localhost:${PORT} ****`);
});
