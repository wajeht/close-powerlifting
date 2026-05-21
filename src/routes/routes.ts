import { OpenAPIHono } from "@hono/zod-openapi";

import type { AppContext } from "../context";
import { createApiRouter } from "./api/api";
import { createGeneralRouter } from "./general/general";

export function createMainRouter(context: AppContext) {
  const app = new OpenAPIHono();
  app.route("/", createGeneralRouter(context));
  app.route("/", createApiRouter(context));
  return app;
}
