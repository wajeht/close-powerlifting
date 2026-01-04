import express from "express";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createFederationsRouter } from "./federations/federations";
import { createHealthCheckRouter } from "./health-check/health-check";
import { createMeetsRouter } from "./meets/meets";
import { createRankingsRouter } from "./rankings/rankings";
import { createRecordsRouter } from "./records/records";
import { createStatusRouter } from "./status/status";
import { createUsersRouter } from "./users/users";

export function createApiRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
  );

  const router = express.Router();

  router.use(
    "/rankings",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createRankingsRouter(context),
  );
  router.use(
    "/federations",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createFederationsRouter(context),
  );
  router.use(
    "/meets",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createMeetsRouter(context),
  );
  router.use(
    "/records",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createRecordsRouter(context),
  );
  router.use(
    "/users",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createUsersRouter(context),
  );

  router.use("/status", createStatusRouter(context));
  router.use("/health-check", createHealthCheckRouter());

  return router;
}
