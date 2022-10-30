import * as db from './utils/db';
import * as crons from './utils/crons';
import app from './app';
import { PORT } from './config/constants';
import logger from './utils/logger';

app.listen(PORT, async () => {
  await db.init();
  await crons.init();

  logger.info(`app was started on http://localhost:${PORT}`);
});
