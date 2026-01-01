import express, { Request, Response } from "express";

const healthCheckRouter = express.Router();

/**
 * Health check response
 * @typedef {object} HealthCheckResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Health status message (ok)
 * @property {boolean} cache - Cache parameter value
 * @property {array} data - Empty array (reserved for future use)
 */

/**
 * GET /api/health-check
 * @tags Health Check
 * @summary Check API health status
 * @description Simple health check endpoint to verify the API is running and responsive. This endpoint does not require authentication and is useful for monitoring and load balancer health checks.
 * @return {HealthCheckResponse} 200 - API is healthy and responding
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/health-check",
 *   "message": "ok",
 *   "cache": false,
 *   "data": []
 * }
 */
healthCheckRouter.get("/", async (req: Request, res: Response) => {
  const data: any = [];

  res.status(200).json({
    status: "success",
    request_url: req.originalUrl,
    message: "ok",
    cache: req.query?.cache,
    data,
  });
});

export { healthCheckRouter };
