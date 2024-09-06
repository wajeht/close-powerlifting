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

import apiRoutes from './api/api';
import {
  appRateLimitMiddleware,
  errorMiddleware,
  hostNameMiddleware,
  notFoundMiddleware,
} from './app.middlewares';
import { ENV, SESSION } from './config/constants';
import swaggerConfig from './config/swagger.config';
import { ENV_ENUMS } from './utils/enums';
import viewsRoutes from './views/views.routes';

const app = express();

app.disable('x-powered-by');

app.use(hostNameMiddleware);

app.set('trust proxy', true);

app.use(cookieParser());

app.use(flash());

app.use(
  session({
    secret: SESSION.SECRET,
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

app.use(
  express.static(path.resolve(path.join(process.cwd(), 'public')), {
    // 30 days in milliseconds
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }),
);

app.engine('html', ejs.renderFile);

app.set('view engine', 'html');

app.set('views', path.resolve(path.join(process.cwd(), 'src', 'views', 'pages')));

app.set('layout', path.resolve(path.join(process.cwd(), 'src', 'views', 'layouts', 'main.html')));

app.use(expressLayouts);

expressJSDocSwagger(app)(swaggerConfig);

app.use(apiRoutes);

app.use(appRateLimitMiddleware());

app.use(viewsRoutes);

app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;
