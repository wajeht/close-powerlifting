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
 * @security BearerAuth
 */

/**
 * GET /api/meets?current_page={current_page}&per_page=${per_page}
 * @tags meets
 * @summary all things relating meets end point with pagination
 * @param {number} per_page.query.required - the per_page - application/x-www-form-urlencoded
 * @param {number} current_page.query.required - the current_page - application/x-www-form-urlencoded
 * @param {boolean} cache.query.required - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */
meets.get(
  '/',
  validate({
    query: MeetsValidations.getMeetsValidation,
  }),
  catchAsyncHandler(MeetsControllers.getMeets),
);

export default meets;
