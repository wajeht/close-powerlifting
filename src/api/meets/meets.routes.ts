import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validate } from '../api.middlewares';
import * as MeetsControllers from './meets.controllers';
import * as MeetsValidations from './meets.validations';

const meets = express.Router();

/**
 * GET /api/meets/{meet}
 * @tags meets
 * @summary get specific detail of a meet
 * @param {string} meet.path.required - the meet - application/x-www-form-urlencoded
 * @security BearerAuth
 */
meets.get(
  '/:meet',
  validate({ params: MeetsValidations.getMeetValidation }),
  catchAsyncHandler(MeetsControllers.getMeet),
);

export default meets;
