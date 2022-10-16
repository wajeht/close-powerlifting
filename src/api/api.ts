import express from 'express';
const api = express.Router();

import RankingsRoutes from './rankings/rankings.routes';
import MeetsRoutes from './meets/meets.routes';
import AuthRoutes from './auth/auth.routes';

api.use('/rankings', RankingsRoutes);
api.use('/meets', MeetsRoutes);
api.use('/auth', AuthRoutes);

export default api;
