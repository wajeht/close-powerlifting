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

export function createApiRouter(ctx: AppContext) {
  const middleware = createMiddleware(
    ctx.cache,
    ctx.userRepository,
    ctx.mail,
    ctx.helpers,
    ctx.logger,
  );

  const router = express.Router();

  router.use(
    "/rankings",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createRankingsRouter(ctx),
  );
  router.use(
    "/federations",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createFederationsRouter(ctx),
  );
  router.use(
    "/meets",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createMeetsRouter(ctx),
  );
  router.use(
    "/records",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createRecordsRouter(ctx),
  );
  router.use(
    "/users",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    createUsersRouter(ctx),
  );

  router.use("/status", createStatusRouter(ctx));
  router.use("/health-check", createHealthCheckRouter());

  return router;
}
