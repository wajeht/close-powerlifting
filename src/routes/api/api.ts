import express from "express";

import { Middleware } from "../middleware";
import { FederationsRouter } from "./federations/federations";
import { HealthCheckRouter } from "./health-check/health-check";
import { MeetsRouter } from "./meets/meets";
import { RankingsRouter } from "./rankings/rankings";
import { RecordsRouter } from "./records/records";
import { StatusRouter } from "./status/status";
import { UsersRouter } from "./users/users";

export function ApiRouter() {
  const middleware = Middleware();

  const router = express.Router();

  router.use(
    "/rankings",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    RankingsRouter(),
  );
  router.use(
    "/federations",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    FederationsRouter(),
  );
  router.use(
    "/meets",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    MeetsRouter(),
  );
  router.use(
    "/records",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    RecordsRouter(),
  );
  router.use(
    "/users",
    middleware.authenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    UsersRouter(),
  );

  router.use("/status", StatusRouter());
  router.use("/health-check", HealthCheckRouter());

  return router;
}
