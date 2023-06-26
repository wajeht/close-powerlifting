import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validate } from '../api.middlewares';
import * as FederationsControllers from './federations.controllers';
import * as FederationsValidations from './federations.validations';

const federations = express.Router();

/**
 * GET /api/federations
 * @tags federations
 * @summary all things relating federations end point
 * @security BearerAuth
 */

/**
 * GET /api/federations?current_page={current_page}&per_page={per_page}
 * @tags federations
 * @summary all things relating federations end point with pagination
 * @param {number} per_page.query.required - the per_page - application/x-www-form-urlencoded
 * @param {number} current_page.query.required - the current_page - application/x-www-form-urlencoded
 * @param {boolean} cache.query.required - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */
federations.get(
  '/',
  validate({ query: FederationsValidations.getFederationsValidation }),
  catchAsyncHandler(FederationsControllers.getFederations),
);

/**
 * GET /api/federations/{federation}?year={year}&cache={cache}
 * @tags federations
 * @summary get list of federations of a federation by year
 * @param {string} federation.path.required - the federation - application/x-www-form-urlencoded
 * @param {number} year.query - the yeare - application/x-www-form-urlencoded
 * @param {boolean} cache.query - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */

/**
 * GET /api/federations/{federation}
 * @tags federations
 * @summary get list of federations of a federation
 * @param {string} federation.path.required - the federation - application/x-www-form-urlencoded
 * @security BearerAuth
 */
federations.get(
  '/:federation',
  validate({
    params: FederationsValidations.getFederationsParamValidation,
    query: FederationsValidations.getFederationsQueryValidation,
  }),
  catchAsyncHandler(FederationsControllers.getFederation),
);

export default federations;
