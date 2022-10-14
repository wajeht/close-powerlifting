import path from 'path';
import { PORT } from '../config/constants';
import pkg from '../../package.json';

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
    version: pkg.version,
  },
  baseDir: path.resolve(path.join(process.cwd(), 'src', 'api')),
  filesPattern: ['./**/*.router.ts', './**/*.routes.ts'],
  swaggerUIPath: '/docs/api',
  exposeSwaggerUI: true,
  notRequiredAsNullable: false,
};
