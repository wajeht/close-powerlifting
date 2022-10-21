import * as db from './utils/db';
import app from './app';
import { PORT } from './config/constants';

app.listen(PORT, async () => {
  await db.init();
  console.log(`app was started on http://localhost:${PORT}`);
});
