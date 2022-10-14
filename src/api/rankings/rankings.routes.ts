import catchAsyncHandler from 'express-async-handler';
import express from 'express';
const rankings = express.Router();

import * as rankingsControllers from './rankings.controllers';

/**
 * GET /api/rankings
 * @summary rankings
 * @param {string} name.query.required - name param description - enum:type1,type2
 * @param {array<string>} license.query - name param description
 * @return {object} 200 - success response - application/json
 */
rankings.get('/', catchAsyncHandler(rankingsControllers.getRankings));

export default rankings;
