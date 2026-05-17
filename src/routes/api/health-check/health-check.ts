import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";

export function createHealthCheckRouter(context: AppContext) {
  const router = express.Router();

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
