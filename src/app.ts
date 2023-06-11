import path from 'path';

import AdminJSExpress from '@adminjs/express';
import MongooseAdapter from '@adminjs/mongoose';
import AdminJS from 'adminjs';
import bcrypt from 'bcryptjs';
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
import apiRoutes from './api/api';
import swaggerConfig from './config/swagger.config';
import viewsRoutes from './views/views.routes';

import * as apiMiddlewares from './api/api.middlewares';
import * as appMiddlewares from './app.middlewares';
import * as rateLimiters from './config/rate-limiters.config';

import {
  COOKIE_NAME,
  COOKIE_PASSWORD,
  ENV,
  SESSION_NAME,
  SESSION_SECRET,
} from './config/constants';
import { ENV_ENUMS } from './utils/enums';
import logger from './utils/logger';
import { User } from './views/views.models';

const app = express();

if (ENV === ENV_ENUMS.PRODUCTION) {
  app.use('/api', rateLimiters.api, apiMiddlewares.auth, apiRoutes);
  app.use(rateLimiters.app);
} else {
  app.use('/api', apiMiddlewares.auth, apiRoutes);
  logger.info('**** skipping rate limiter for both api and app in dev environment ****');
}

// ---------------------------------- ADMINJS STARTS ----------------------------------
AdminJS.registerAdapter(MongooseAdapter);

const adminJs = new AdminJS({
  resources: [User],
});

// const adminRouter = AdminJSExpress.buildRouter(admin);

const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email, password) => {
      try {
        logger.info(
          `**** account with ${email}:${password} is trying to login to admin panel ****`,
        );
        const user = await User.findOne({ email });
        if (user) {
          const matched = await bcrypt.compare(password, user.password!);
          if (matched && user.admin) {
            return user;
          }
        }
      } catch (error) {
        logger.info(`**** adminjs login failed: ${error} **** `);
      }
      return false;
    },
    cookieName: COOKIE_NAME,
    cookiePassword: COOKIE_PASSWORD,
  },
  null,
  {
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    // cookie: {
    //   httpOnly: ENV === ENV_ENUMS.PRODUCTION,
    //   secure: ENV === ENV_ENUMS.PRODUCTION,
    // },
    name: SESSION_NAME,
  },
);

app.use(adminJs.options.rootPath, adminRouter);

// ---------------------------------- ADMINJS ENDS ----------------------------------

app.use(cookieParser());
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
