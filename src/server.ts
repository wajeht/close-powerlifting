import * as db from './utils/db';
import * as crons from './utils/crons';
import app from './app';
import { PORT } from './config/constants';

app.listen(PORT, async () => {
  await db.init();
  await crons.init();

  console.log(`app was started on http://localhost:${PORT}`);
});
