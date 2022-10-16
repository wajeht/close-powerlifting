import express from 'express';
const api = express.Router();

import RankingsRoutes from './rankings/rankings.routes';
import MeetsRoutes from './meets/meets.routes';

api.use('/rankings', RankingsRoutes);
api.use('/meets', MeetsRoutes);

export default api;
