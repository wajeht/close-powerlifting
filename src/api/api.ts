import express from 'express';

import * as apiMiddlewares from './api.middlewares';
import AuthRoutes from './auth/auth.routes';
import FederationsRoutes from './federations/federations.routes';
import MeetsRoutes from './meets/meets.routes';
import RankingsRoutes from './rankings/rankings.routes';
import RecordsRoutes from './records/records.routes';
import StatusRoutes from './status/status.routes';
import UsersRoutes from './users/users.routes';

const api = express.Router();

api.use('/auth', AuthRoutes);

api.use('/rankings', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, RankingsRoutes);
api.use('/federations', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, FederationsRoutes);
api.use('/records', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, RecordsRoutes);
api.use('/meets', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, MeetsRoutes);
api.use('/users', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, UsersRoutes);
api.use('/status', apiMiddlewares.auth, apiMiddlewares.trackAPICalls, StatusRoutes);

export default api;
