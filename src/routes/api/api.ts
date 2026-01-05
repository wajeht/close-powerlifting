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

  router.use("/rankings", createRankingsRouter(context));
  router.use("/federations", createFederationsRouter(context));
  router.use("/meets", createMeetsRouter(context));
  router.use("/records", createRecordsRouter(context));
  router.use("/users", createUsersRouter(context));
  router.use("/status", createStatusRouter(context));
  router.use("/health-check", createHealthCheckRouter());

  return router;
}
