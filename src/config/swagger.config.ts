import path from 'path';

import pkg from '../../package.json';
import { DOMAIN, ENV, PORT } from '../config/constants';
import { ENV_ENUMS } from '../utils/enums';

let LINK = '';

if (ENV === ENV_ENUMS.PRODUCTION) {
  LINK = DOMAIN!;
} else {
  LINK = `http://localhost:${PORT}`;
}

export default {
  info: {
    title: 'close-powerlifting',
    description: 'an intuitive api for open-powerlifting database',
    termsOfService: `${LINK}/terms`,
    contact: {
      name: 'API Support',
      url: `${LINK}/contact`,
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
