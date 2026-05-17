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

  router.use(createRankingsRouter(context));
  router.use(createFederationsRouter(context));
  router.use(createMeetsRouter(context));
  router.use(createRecordsRouter(context));
  router.use(createUsersRouter(context));
  router.use(createStatusRouter(context));
  router.use(createHealthCheckRouter(context));

  return router;
}
