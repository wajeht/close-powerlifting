import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import expressJSDocSwagger from 'express-jsdoc-swagger';

import swaggerConfig from './config/swagger.config';
import apiRoutes from './api/api';
import * as appRoutes from './app.routes';

const app = express();

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

expressJSDocSwagger(app)(swaggerConfig);

app.use('/api', apiRoutes);
app.get('/health-check', appRoutes.healthCheckHandler);

app.use(appRoutes.notFoundHandler);
app.use(appRoutes.serverErrorHandler);

export default app;
