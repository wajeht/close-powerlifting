import catchAsyncHandler from 'express-async-handler';
import express from 'express';
const rankings = express.Router();

import * as rankingsControllers from './rankings.controllers';

rankings.get('/', catchAsyncHandler(rankingsControllers.getRankings));

export default rankings;
