import express from 'express';
const api = express.Router();

import RankingsRoutes from './rankings/rankings.routes';
import MeetsRoutes from './meets/meets.routes';
import UsersRoutes from './users/users.routes';
import RecordsRoutes from './records/records.routes';
import StatusRoutes from './status/status.routes';

api.use('/rankings', RankingsRoutes);
api.use('/meets', MeetsRoutes);
api.use('/records', RecordsRoutes);
api.use('/users', UsersRoutes);
api.use('/status', StatusRoutes);

export default api;
