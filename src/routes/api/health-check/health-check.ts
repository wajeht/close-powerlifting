import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createHealthCheckService } from "./health-check.service";

/**
 * Health check data
 * @typedef {object} HealthCheckData
 * @property {number} uptime - Process uptime in seconds
 * @property {number} timestamp - Current Unix timestamp in milliseconds
 * @property {string} data - "ready" once the in-memory store is loaded
 */

/**
 * Health check response
 * @typedef {object} HealthCheckResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Health status message
 * @property {HealthCheckData} data - Process + store readiness fields
 */

/**
 * Health check warming-up response
 * @typedef {object} HealthCheckWarmingUpResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - "Data is still loading"
 * @property {object[]} errors - Empty array
 * @property {object[]} data - Empty array
 */

export function createHealthCheckRouter(context: AppContext) {
  const healthCheckService = createHealthCheckService(context.store);
  const router = express.Router();

  /**
   * GET /api/health-check
   * @tags Health Check
   * @summary Check API health status
   * @description Readiness probe. Returns 200 once the in-memory snapshot is loaded, 503 while the boot-time stream-read is still running (~20s after process start). Anonymous and unmetered — safe to call from load balancers and uptime monitors.
   * @return {HealthCheckResponse} 200 - API is healthy and the data store is ready
   * @return {HealthCheckWarmingUpResponse} 503 - Snapshot still loading
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/health-check",
   *   "message": "The resource was returned successfully!",
   *   "data": { "uptime": 412.3, "timestamp": 1779016245724, "data": "ready" }
   * }
   * @example response - 503 - Warming up
   * {
   *   "status": "fail",
   *   "request_url": "/api/health-check",
   *   "message": "Data is still loading",
   *   "errors": [],
   *   "data": []
   * }
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
