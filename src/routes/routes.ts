import express from "express";

import type { AppContext } from "../context";
import { createApiRouter } from "./api/api";
import { createAuthRouter } from "./auth/auth";
import { createGeneralRouter } from "./general/general";

export function createMainRouter(context: AppContext) {
  const router = express.Router();

  router.use("/", createGeneralRouter(context));
  router.use("/", createAuthRouter(context));
  router.use("/api/auth", createAuthRouter(context));
  router.use("/api", createApiRouter(context));

  return router;
}
