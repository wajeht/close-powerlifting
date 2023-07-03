import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import * as HealthCheckControllers from './health-check.controllers';

const healthCheck = express.Router();

/**
 * GET /api/health-check
 * @tags health-check
 * @summary get the health of open powerlifing api
 */
healthCheck.get('/', catchAsyncHandler(HealthCheckControllers.getHealthCheck));

export default healthCheck;
