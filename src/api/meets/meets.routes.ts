import catchAsyncHandler from 'express-async-handler';

import * as MeetsControllers from './meets.controllers';

import express from 'express';
const meets = express.Router();

/**
 * GET /api/meets
 * @tags meets
 * @summary all things relating meets end point
 */
meets.get('/', catchAsyncHandler(MeetsControllers.getMeets));

export default meets;
