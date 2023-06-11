import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validate } from '../api.middlewares';
import * as StatusControllers from './status.controllers';
import * as StatusValidations from './status.validations';

const status = express.Router();

/**
 * GET /api/status
 * @tags status
 * @summary all things relating status end point
 * @security BearerAuth
 */

status.get(
  '/',
  validate({ query: StatusValidations.getStatusValidation }),
  catchAsyncHandler(StatusControllers.getStatus),
);

export default status;
