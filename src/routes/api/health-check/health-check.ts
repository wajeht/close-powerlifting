import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";

export function createHealthCheckRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/health-check
   * @summary Readiness probe
   * @tags Health
   * @return {object} 200 - Data is loaded and the cron is running
   * @return {object} 503 - Data is still loading (typically <90 s after boot)
   */
  router.get("/api/health-check", (_req: Request, res: Response) => {
    const ready = context.store.tryGet() != null;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "warming up",
      uptime: process.uptime(),
      timestamp: Date.now(),
      data: ready ? "ready" : "loading",
      crons: context.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  return router;
}
