import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as RecordsControllers from './records.controllers';
import * as RecordsValidation from './records.validations';

import express from 'express';
const records = express.Router();

/**
 * GET /api/records
 * @tags records
 * @summary all things relating records end point
 * @security BearerAuth
 */

records.get(
  '/',
  validate({ query: RecordsValidation.getRecordsValidation }),
  catchAsyncHandler(RecordsControllers.getRecords),
);

export default records;
