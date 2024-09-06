import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validationMiddleware } from '../api.middlewares';
import { getRankingsValidation, getRankValidation } from './rankings.validations';
import { getRank, getRankings } from './rankings.controllers';

const rankings = express.Router();

/**
 * GET /api/rankings
 * @tags rankings
 * @summary all things relating rankings end point
 * @security BearerAuth
 */

/**
 * GET /api/rankings?current_page={current_page}&per_page=${per_page}
 * @tags rankings
 * @summary all things relating rankings end point with pagination
 * @param {number} per_page.query.required - the per_page - application/x-www-form-urlencoded
 * @param {number} current_page.query.required - the current_page - application/x-www-form-urlencoded
 * @param {boolean} cache.query.required - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */
rankings.get(
  '/',
  validationMiddleware({ query: getRankingsValidation }),
  catchAsyncHandler(getRankings),
);

/**
 * GET /api/rankings/{rank}
 * @tags rankings
 * @summary get specific details about a rank
 * @param {string} rank.path.required - the rank - application/x-www-form-urlencoded
 * @security BearerAuth
 */
rankings.get(
  '/:rank',
  validationMiddleware({ params: getRankValidation }),
  catchAsyncHandler(getRank),
);

export default rankings;
