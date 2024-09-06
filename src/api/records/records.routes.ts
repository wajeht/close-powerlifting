import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validationMiddleware } from '../api.middlewares';
import { getRecordsValidation } from './records.validations';
import { getRecords } from './records.controllers';

const records = express.Router();

/**
 * GET /api/records
 * @tags records
 * @summary all things relating records end point
 * @security BearerAuth
 */
records.get(
  '/',
  validationMiddleware({ query: getRecordsValidation }),
  catchAsyncHandler(getRecords),
);

export default records;
