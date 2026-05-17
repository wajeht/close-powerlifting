// API router. Sub-routers are wired in phase 3 as each endpoint gets
// rewritten against the in-memory store.

import express from "express";

import type { AppContext } from "../../context";

export function createApiRouter(_context: AppContext) {
  const router = express.Router();
  // Sub-routers go here as they land:
  //   router.use(createRankingsRouter(_context));
  //   router.use(createRecordsRouter(_context));
  //   router.use(createUsersRouter(_context));
  //   router.use(createMeetsRouter(_context));
  //   router.use(createFederationsRouter(_context));
  //   router.use(createStatusRouter(_context));
  return router;
}
