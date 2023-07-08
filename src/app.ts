import compression from 'compression';
import flash from 'connect-flash';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import ejs from 'ejs';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';

import { adminJs, adminRouter } from './admin/admin';
import apiRoutes from './api/api';
import * as appMiddlewares from './app.middlewares';
import { ENV, SESSION_SECRET } from './config/constants';
import * as rateLimiters from './config/rate-limiters.config';
import swaggerConfig from './config/swagger.config';
import { ENV_ENUMS } from './utils/enums';
import logger from './utils/logger';
import viewsRoutes from './views/views.routes';

const app = express();

app.disable('x-powered-by');
app.use(appMiddlewares.handleHostname);
app.set('trust proxy', true);
app.use(adminJs.options.rootPath, adminRouter);
app.use(cookieParser());
app.use(flash());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: ENV === ENV_ENUMS.PRODUCTION,
      secure: ENV === ENV_ENUMS.PRODUCTION,
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ contentSecurityPolicy: false }));

if (ENV === ENV_ENUMS.PRODUCTION) {
  app.use('/api', rateLimiters.api, apiRoutes);
  app.use(rateLimiters.app);
} else {
  app.use('/api', apiRoutes);
  logger.info(
    `**** skipping rate limiter for both api and app in ${process.env.ENV} environment ****`,
  );
}

(async () => {
  if (ENV == ENV_ENUMS.PRODUCTION) {
    await adminJs.initialize();
  } else {
    adminJs.watch();
  }
})();

app.use(
  express.static(path.resolve(path.join(process.cwd(), 'public')), {
    maxAge: '24h',
  }),
);

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.resolve(path.join(process.cwd(), 'src', 'views', 'pages')));
app.set('layout', '../layouts/main.html');

app.use(expressLayouts);

expressJSDocSwagger(app)(swaggerConfig);

app.use(viewsRoutes);

app.use(appMiddlewares.notFoundHandler);
app.use(appMiddlewares.serverErrorHandler);

export default app;
