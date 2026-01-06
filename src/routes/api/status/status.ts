import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createMiddleware } from "../../middleware";
import { createStatusService } from "./status.service";
import { getStatusValidation, GetStatusType } from "./status.validation";

/**
 * Federation status
 * @typedef {object} FederationStatus
 * @property {string} name - Federation name
 * @property {string} meetsentered - Number of meets entered
 * @property {string} status - Federation status
 * @property {string} newmeetdetection - New meet detection status
 * @property {string} resultsformat - Results format
 * @property {string} easeofimport - Ease of import rating
 * @property {string} maintainers - Federation maintainers
 */

/**
 * Status data
 * @typedef {object} StatusData
 * @property {string} server_version - Server version commit hash
 * @property {string} meets - Total meets tracked
 * @property {FederationStatus[]} federations - Federation status list
 */

/**
 * Status response
 * @typedef {object} StatusResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {StatusData} data - Status data
 */

export function createStatusRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );
  const statusService = createStatusService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/status
   * @tags Status
   * @summary Get data source status and statistics
   * @description Returns information about the OpenPowerlifting data source including server version, total meets tracked, and status of all federations.
   * @security BearerAuth
   * @return {StatusResponse} 200 - Status information
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/status",
   *   "message": "The resource was returned successfully!",
   *   "data": {"server_version": "abc123", "meets": "50000", "federations": []}
   * }
   */
  router.get(
    "/",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getStatusValidation }),
    async (req: Request<{}, {}, GetStatusType>, res: Response) => {
      const status = await statusService.getStatus({});

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: status.data,
      });
    },
  );

  return router;
}
