import app from './app';
import { PORT } from './config/constants';

app.listen(PORT, () => console.log(`App was started on http://localhost:${PORT}`));
