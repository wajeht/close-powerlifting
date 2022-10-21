import path from 'path';
import { PORT } from '../config/constants';
import pkg from '../../package.json';

export default {
  info: {
    title: 'close-powerlifting',
    description: 'an intuitive api for open-powerlifting database',
    termsOfService: `http://localhost:${PORT}/terms`,
    contact: {
      name: 'API Support',
      url: `http://localhost:${PORT}/contact`,
    },
    license: {
      name: 'MIT',
      url: 'https://github.com/wajeht/close-powerlifting/blob/main/LICENSE',
    },
    version: pkg.version,
  },
  baseDir: path.resolve(path.join(process.cwd(), 'src')),
  filesPattern: ['**/*.router.ts', '**/*.routes.ts'],
  swaggerUIPath: '/docs/api',
  exposeSwaggerUI: true,
  notRequiredAsNullable: false,
  security: {
    BearerAuth: {
      type: 'http',
      scheme: 'Bearer',
    },
  },
};
