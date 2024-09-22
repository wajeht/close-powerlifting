import path from 'path';

import pkg from '../../package.json';
import { appConfig } from '../config/constants';

let link = `http://localhost:${appConfig.port}`;

if (appConfig.env === 'production') {
  link = appConfig.domain!;
}

export default {
  info: {
    title: 'close-powerlifting',
    description: 'an intuitive api for open-powerlifting database',
    termsOfService: `${link}/terms`,
    contact: {
      name: 'API Support',
      url: `${link}/contact`,
    },
    license: {
      name: 'MIT',
      url: 'https://github.com/wajeht/close-powerlifting/blob/main/LICENSE',
    },
    version: pkg.version,
  },
  security: {
    BearerAuth: {
      type: 'http',
      scheme: 'bearer',
    },
  },
  baseDir: path.resolve(path.join(process.cwd(), 'src')),
  filesPattern: ['**/*.router.ts', '**/*.routes.ts', '**/*.routes-controllers.ts'],
  swaggerUIPath: '/docs/api',
  exposeSwaggerUI: true,
  notRequiredAsNullable: false,
};
