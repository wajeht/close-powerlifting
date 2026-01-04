import express from "express";

import type { AppContext } from "../context";
import { createApiRouter } from "./api/api";
import { createAuthRouter } from "./auth/auth";
import { createGeneralRouter } from "./general/general";

export function createMainRouter(ctx: AppContext) {
  const router = express.Router();

  router.use("/", createGeneralRouter(ctx));
  router.use("/", createAuthRouter(ctx));
  router.use("/api/auth", createAuthRouter(ctx));
  router.use("/api", createApiRouter(ctx));

  return router;
}
