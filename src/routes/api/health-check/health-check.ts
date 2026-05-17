import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createHealthCheckService } from "./health-check.service";

export function createHealthCheckRouter(context: AppContext) {
  const healthCheckService = createHealthCheckService(context.store);
  const router = express.Router();

  /**
   * GET /api/health-check
   * @tags Health Check
   * @summary Check API health status
   */
  router.get("/api/health-check", (req: Request, res: Response) => {
    if (!healthCheckService.isReady()) {
      res.status(503).json({
        status: "fail",
        request_url: req.originalUrl,
        message: "Data is still loading",
        errors: [],
        data: [],
      });
      return;
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: healthCheckService.getHealthCheck(),
    });
  });

  return router;
}
