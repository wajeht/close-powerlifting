import express from "express";

import {
  apiRateLimitMiddleware,
  authenticationMiddleware,
  trackAPICallsMiddleware,
} from "./api.middlewares";
import AuthRoutes from "./auth/auth.routes";
import FederationsRoutes from "./federations/federations.routes";
import HealthCheckRoutes from "./health-check/health-check.routes";
import MeetsRoutes from "./meets/meets.routes";
import RankingsRoutes from "./rankings/rankings.routes";
import RecordsRoutes from "./records/records.routes";
import StatusRoutes from "./status/status.routes";
import UsersRoutes from "./users/users.routes";

const api = express.Router();

api.use(apiRateLimitMiddleware());

api.use("/api/auth", AuthRoutes);

api.use("/api/health-check", HealthCheckRoutes);
api.use("/api/rankings", authenticationMiddleware, trackAPICallsMiddleware, RankingsRoutes);
api.use("/api/federations", authenticationMiddleware, trackAPICallsMiddleware, FederationsRoutes);
api.use("/api/records", authenticationMiddleware, trackAPICallsMiddleware, RecordsRoutes);
api.use("/api/meets", authenticationMiddleware, trackAPICallsMiddleware, MeetsRoutes);
api.use("/api/users", authenticationMiddleware, trackAPICallsMiddleware, UsersRoutes);
api.use("/api/status", authenticationMiddleware, trackAPICallsMiddleware, StatusRoutes);

export default api;
