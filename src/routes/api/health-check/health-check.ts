import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { sendSuccess } from "../api.helpers";

export function createHealthCheckRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/health-check
   * @summary Readiness probe
   * @tags Health Check
   * @return {object} 200 - Data is loaded and the cron is running
   * @return {object} 503 - Data is still loading
   */
  router.get("/api/health-check", (req: Request, res: Response) => {
    const ready = context.store.tryGet() != null;
    if (!ready) {
      res.status(503).json({
        status: "fail",
        request_url: req.originalUrl,
        message: "Data is still loading",
        errors: [],
        data: [],
      });
      return;
    }
    sendSuccess(
      res,
      {
        uptime: process.uptime(),
        timestamp: Date.now(),
        data: "ready",
        crons: context.cron.getStatus().isRunning ? "started" : "stopped",
      },
      { requestUrl: req.originalUrl },
    );
  });

  return router;
}
