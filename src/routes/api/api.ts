import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../../context";
import { createFederationsRouter } from "./federations/federations";
import { createHealthCheckRouter } from "./health-check/health-check";
import { createMeetsRouter } from "./meets/meets";
import { createRankingsRouter } from "./rankings/rankings";
import { createRecordsRouter } from "./records/records";
import { createStatusRouter } from "./status/status";
import { createUsersRouter } from "./users/users";

export function createApiRouter(context: AppContext) {
  const app = new OpenAPIHono();
  app.route("/", createStatusRouter(context));
  app.route("/", createHealthCheckRouter(context));
  app.route("/", createRankingsRouter(context));
  app.route("/", createRecordsRouter(context));
  app.route("/", createUsersRouter(context));
  app.route("/", createMeetsRouter(context));
  app.route("/", createFederationsRouter(context));
  return app;
}
