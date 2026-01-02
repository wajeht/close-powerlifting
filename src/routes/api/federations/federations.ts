import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { Logger } from "../../../utils/logger";
import { Middleware } from "../../middleware";
import { FederationsService } from "./federations.service";
import {
  getFederationsValidation,
  getFederationsParamValidation,
  getFederationsQueryValidation,
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

/**
 * Pagination info
 * @typedef {object} Pagination
 * @property {number} current_page - Current page number
 * @property {number} per_page - Items per page
 * @property {number} from - Starting item index
 * @property {number} to - Ending item index
 * @property {number} items - Total items
 * @property {number} pages - Total pages
 * @property {number} first_page - First page number
 * @property {number} last_page - Last page number
 */

/**
 * A federation meet entry
 * @typedef {object} FederationMeet
 * @property {string} federation - Federation code (e.g., IPF, USAPL, USPA)
 * @property {string} date - Meet date
 * @property {string} meetname - Competition name
 * @property {string} location - Meet location
 */

/**
 * Federations list response
 * @typedef {object} FederationsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {array<FederationMeet>} data - Array of federation meets
 * @property {Pagination} pagination - Pagination info
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {array} data - Empty array
 */

export function FederationsRouter() {
  const middleware = Middleware();
  const logger = Logger();
  const federationsService = FederationsService();

  const router = express.Router();

  /**
   * GET /api/federations
   * @tags Federations
   * @summary Get all federations with optional pagination
   * @description Returns a paginated list of all powerlifting federations with their meets
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {FederationsResponse} 200 - Success response with federations list
   * @return {ErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"federation": "IPF", "meetname": "World Championships"}]
   * }
   */
  router.get(
    "/",
    middleware.apiValidationMiddleware({ query: getFederationsValidation }),
    async (req: Request<{}, {}, GetFederationsType>, res: Response) => {
      const federations = await federationsService.getFederations(req.query);

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: federations?.cache,
        data: federations?.data,
        pagination: federations?.pagination,
      });
    },
  );

  /**
   * GET /api/federations/{federation}
   * @tags Federations
   * @summary Get meets for a specific federation
   * @description Returns meet results for a specific federation, optionally filtered by year
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} federation.path.required - Federation code (e.g., ipf, usapl, uspa, wrpf)
   * @param {number} year.query - Filter results by competition year (e.g., 2024)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {FederationsResponse} 200 - Success response with federation results
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Federation not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations/ipf",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"meetname": "World Championships", "date": "2024-06-15"}]
   * }
   */
  router.get(
    "/:federation",
    middleware.apiValidationMiddleware({
      params: getFederationsParamValidation,
      query: getFederationsQueryValidation,
    }),
    async (req: Request<GetFederationsParamType, {}, GetFederationsQueryType>, res: Response) => {
      const federations = await federationsService.getFederation({ ...req.params, ...req.query });

      if (!federations?.data) throw new NotFoundError("The resource cannot be found!");

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: federations?.cache,
        data: federations?.data,
      });
    },
  );

  return router;
}
