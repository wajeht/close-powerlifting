import express from "express";

import type { AppContext } from "../context";
import { createApiRouter } from "./api/api";
import { createGeneralRouter } from "./general/general";

export function createMainRouter(context: AppContext) {
  const router = express.Router();

  router.use(createGeneralRouter(context));
  router.use(createApiRouter(context));

  return router;
}
