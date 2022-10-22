import path from 'path';

import express from 'express';
import cors from 'cors';
import flash from 'connect-flash';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import expressLayouts from 'express-ejs-layouts';
import ejs from 'ejs';

import * as rateLimiters from './config/rate-limiters.config';
import swaggerConfig from './config/swagger.config';
import apiRoutes from './api/api';
import viewsRoutes from './views/views.routes';
import * as appMiddlewares from './app.middlewares';
import { ENV, SESSION_SECRET } from './config/constants';
import * as middlewares from './api/api.middlewares';

const app = express();

app.use(flash());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  }),
);
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  express.static(path.resolve(path.join(process.cwd(), 'src', 'public')), {
    maxAge: '24h',
  }),
);

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.resolve(path.join(process.cwd(), 'src', 'views', 'pages')));
app.set('layout', '../layouts/main.html');

app.use(expressLayouts);
expressJSDocSwagger(app)(swaggerConfig);

if (ENV !== 'development') {
  app.use('/api', rateLimiters.api, middlewares.auth, apiRoutes);
  app.use(rateLimiters.app);
} else {
  app.use('/api', middlewares.auth, apiRoutes);
}

app.use(viewsRoutes);

app.use(appMiddlewares.notFoundHandler);
app.use(appMiddlewares.serverErrorHandler);

export default app;
