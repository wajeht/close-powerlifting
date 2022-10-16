import path from 'path';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import ejs from 'ejs';

import swaggerConfig from './config/swagger.config';
import apiRoutes from './api/api';
import * as appRoutes from './app.routes';

const app = express();

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(path.join(process.cwd(), 'src', 'public'))));

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.resolve(path.join(process.cwd(), 'src', 'pages')));

expressJSDocSwagger(app)(swaggerConfig);

app.use('/api', apiRoutes);
app.get('/health-check', appRoutes.healthCheckHandler);

app.use(appRoutes.homePageHandler);
app.use(appRoutes.notFoundHandler);
app.use(appRoutes.serverErrorHandler);

export default app;
