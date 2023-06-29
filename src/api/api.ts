import express from 'express';

import FederationsRoutes from './federations/federations.routes';
import MeetsRoutes from './meets/meets.routes';
import RankingsRoutes from './rankings/rankings.routes';
import RecordsRoutes from './records/records.routes';
import StatusRoutes from './status/status.routes';
import UsersRoutes from './users/users.routes';

const api = express.Router();

api.use('/rankings', RankingsRoutes);
api.use('/federations', FederationsRoutes);
api.use('/records', RecordsRoutes);
api.use('/meets', MeetsRoutes);
api.use('/users', UsersRoutes);
api.use('/status', StatusRoutes);

export default api;
