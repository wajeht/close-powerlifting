import path from 'path';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import expressLayouts from 'express-ejs-layouts';
import ejs from 'ejs';

import swaggerConfig from './config/swagger.config';
import apiRoutes from './api/api';
import * as appRoutes from './app.routes';

const app = express();

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(path.join(process.cwd(), 'src', 'public'))));

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.resolve(path.join(process.cwd(), 'src', 'views', 'pages')));
app.set('layout', '../layouts/main.html');

app.use(expressLayouts);
expressJSDocSwagger(app)(swaggerConfig);

app.use('/api', apiRoutes);
app.get('/health-check', appRoutes.healthCheckHandler);
app.get('/', appRoutes.homePageHandler);
app.get('/contact', appRoutes.contactPageHandler);
app.get('/terms', appRoutes.termsPageHandler);
app.get('/about', appRoutes.aboutPageHandler);
app.get('/privacy', appRoutes.privacyPageHandler);

app.use(appRoutes.notFoundHandler);
app.use(appRoutes.serverErrorHandler);

export default app;
