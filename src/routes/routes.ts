import express from "express";

import type { AppContext } from "../context";
import { createAdminRouter } from "./admin/admin";
import { createApiRouter } from "./api/api";
import { createAuthRouter } from "./auth/auth";
import { createDashboardRouter } from "./dashboard/dashboard";
import { createGeneralRouter } from "./general/general";
import { createSettingsRouter } from "./settings/settings";

export function createMainRouter(context: AppContext) {
  const router = express.Router();

  router.use(createGeneralRouter(context));
  router.use(createAuthRouter(context));
  router.use(createDashboardRouter(context));
  router.use(createSettingsRouter(context));
  router.use(createApiRouter(context));
  router.use(createAdminRouter(context));

  return router;
}
