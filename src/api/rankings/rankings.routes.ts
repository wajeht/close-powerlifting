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
rankings.get(
  '/',
  validate({ query: RankingsValidation.getRankingsValidation }),
  catchAsyncHandler(RankingsControllers.getRankings),
);

export default rankings;
