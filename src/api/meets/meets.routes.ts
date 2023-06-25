import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validate } from '../api.middlewares';
import * as MeetsControllers from './meets.controllers';
import * as MeetsValidations from './meets.validations';

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
  validate({ query: MeetsValidations.getMeetsValidation }),
  catchAsyncHandler(MeetsControllers.getMeets),
);

/**
 * GET /api/meets/{federation}?year={year}&cache={cache}
 * @tags meets
 * @summary get list of meets of a federation by year
 * @param {string} federation.path.required - the fed - application/x-www-form-urlencoded
 * @param {number} year.query - the yeare - application/x-www-form-urlencoded
 * @param {boolean} cache.query - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */

/**
 * GET /api/meets/{federation}
 * @tags meets
 * @summary get list of meets of a federation
 * @param {string} federation.path.required - the fed - application/x-www-form-urlencoded
 * @security BearerAuth
 */
meets.get(
  '/:federation',
  validate({
    params: MeetsValidations.getFederationsParamValidation,
    query: MeetsValidations.getFederationsQueryValidation,
  }),
  catchAsyncHandler(MeetsControllers.getFederations),
);

export default meets;
