import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as MeetsControllers from './meets.controllers';
import * as MeetsValidations from './meets.validations';

import express from 'express';
const meets = express.Router();

/**
 * GET /api/meets
 * @tags meets
 * @summary all things relating meets end point
 */
meets.get(
  '/',
  validate({
    query: MeetsValidations.getMeetsValidation,
  }),
  catchAsyncHandler(MeetsControllers.getMeets),
);

export default meets;
