import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as StatusControllers from './status.controllers';

import express from 'express';
const status = express.Router();

/**
 * GET /api/status
 * @tags status
 * @summary all things relating status end point
 * @security BearerAuth
 */

status.get('/', catchAsyncHandler(StatusControllers.getStatus));

export default status;
