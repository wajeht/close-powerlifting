import path from 'path';
import { PORT } from '../config/constants';
export default {
  info: {
    title: 'close-powerlifting',
    description: 'The best way to track your workouts',
    termsOfService: `http://localhost:${PORT}/terms`,
    contact: {
      name: 'API Support',
      url: `http://localhost:${PORT}/contact`,
    },
    license: {
      name: 'MIT',
      url: 'https://www.gnu.org/licenses/gpl-3.0.en.html',
    },
    version: '0.0.1',
  },
  baseDir: path.resolve(path.join(process.cwd(), 'src', 'api')),
  filesPattern: ['./**/*.router.ts', '*.ts', './**/*.routes.ts', 'app.js'],
  swaggerUIPath: '/docs/api',
  exposeSwaggerUI: true,
  notRequiredAsNullable: false,
  swaggerUiOptions: {},
  multiple: {},
};
