import express from "express";

import type { AppContext } from "../../context";
import { createFederationsRouter } from "./federations/federations";
import { createHealthCheckRouter } from "./health-check/health-check";
import { createMeetsRouter } from "./meets/meets";
import { createRankingsRouter } from "./rankings/rankings";
import { createRecordsRouter } from "./records/records";
import { createStatusRouter } from "./status/status";
import { createUsersRouter } from "./users/users";

export function createApiRouter(context: AppContext) {
  const router = express.Router();

  router.use("/api/rankings", createRankingsRouter(context));
  router.use("/api/federations", createFederationsRouter(context));
  router.use("/api/meets", createMeetsRouter(context));
  router.use("/api/records", createRecordsRouter(context));
  router.use("/api/users", createUsersRouter(context));
  router.use("/api/status", createStatusRouter(context));
  router.use("/api/health-check", createHealthCheckRouter(context));

  return router;
}
