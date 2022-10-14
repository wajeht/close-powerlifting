import express from 'express';
const api = express.Router();

import rankingsRoutes from './rankings/rankings.routes';

api.use('/rankings', rankingsRoutes);

export default api;
