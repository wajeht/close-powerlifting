import express, { Request, Response } from "express";

import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getStatus } from "./status.service";
import { getStatusValidation, GetStatusType } from "./status.validation";

const statusRouter = express.Router();

/**
 * Data source status
 * @typedef {object} DataSourceStatus
 * @property {string} source - Data source name (OpenPowerlifting)
 * @property {string} last_updated - Last update timestamp
 * @property {number} total_entries - Total number of entries in database
 * @property {number} total_meets - Total number of meets
 * @property {number} total_lifters - Total number of unique lifters
 */

/**
 * Status response
 * @typedef {object} StatusResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {DataSourceStatus} data - Data source status information
 */

/**
 * GET /api/status
 * @tags Status
 * @summary Get data source status
 * @description Returns information about the data source including last update time and database statistics. This endpoint does not require authentication.
 * @param {boolean} cache.query - Use cached data - default: true
 * @return {StatusResponse} 200 - Success response with data source status
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/status",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": {
 *     "source": "OpenPowerlifting",
 *     "last_updated": "2024-01-15T00:00:00Z",
 *     "total_entries": 3000000,
 *     "total_meets": 50000,
 *     "total_lifters": 1000000
 *   }
 * }
 */
statusRouter.get(
  "/",
  apiValidationMiddleware({ query: getStatusValidation }),
  async (req: Request<{}, {}, GetStatusType>, res: Response) => {
    const status = await getStatus(req.query);

    logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: status.cache,
      data: status.data,
    });
  },
);

export { statusRouter };
