import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validationMiddleware } from '../api.middlewares';
import * as RecordsControllers from './records.controllers';
import * as RecordsValidation from './records.validations';

const records = express.Router();

/**
 * GET /api/records
 * @tags records
 * @summary all things relating records end point
 * @security BearerAuth
 */
records.get(
  '/',
  validationMiddleware({ query: RecordsValidation.getRecordsValidation }),
  catchAsyncHandler(RecordsControllers.getRecords),
);

export default records;
