import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as RankingsControllers from './rankings.controllers';
import * as RankingsValidation from './rankings.validations';

import express from 'express';
const rankings = express.Router();

/**
 * GET /api/rankings
 * @tags rankings
 * @summary all things relating rankings end point
 */

/**
 * GET /api/rankings?current_page={current_page}&per_page=${per_page}
 * @tags rankings
 * @summary all things relating rankings end point with pagination
 * @param {number} per_page.query.required - the per_page - application/x-www-form-urlencoded
 * @param {number} current_page.query.required - the current_page - application/x-www-form-urlencoded
 * @param {boolean} cache.query.required - the cache - application/x-www-form-urlencoded
 */
rankings.get(
  '/',
  validate({ query: RankingsValidation.getRankingsValidation }),
  catchAsyncHandler(RankingsControllers.getRankings),
);

export default rankings;
