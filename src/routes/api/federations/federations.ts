import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createFederationService } from "./federations.service";
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
 * @property {FederationMeet[]} data - Array of federation meets
 * @property {Pagination} pagination - Pagination info
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} errors - Error details array
 * @property {object[]} data - Empty array
 */

export function createFederationsRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.apiCallLogRepository,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );
  const federationService = createFederationService(context.knex);

  const router = express.Router();

  /**
   * GET /api/federations
   * @tags Federations
   * @summary Get all federations with optional pagination
   * @description Returns a paginated list of all powerlifting federations with their meets
   * @security BearerAuth
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @return {FederationsResponse} 200 - Success response with federations list
   * @return {ErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {ErrorResponse} 400 - Validation error - Invalid query parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"federation": "IPF", "meetname": "World Championships"}]
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/federations",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getFederationsValidation }),
    async (req: Request<{}, {}, GetFederationsType>, res: Response) => {
      const federations = await federationService.getFederations(req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: federations?.data,
        pagination: federations?.pagination,
      });
    },
  );

  /**
   * Federation year stat
   * @typedef {object} FederationYearStat
   * @property {number} year - Year
   * @property {number} meets - Meets in that year
   */

  /**
   * Federation stats
   * @typedef {object} FederationStatsData
   * @property {string} federation - Federation slug
   * @property {number} total_meets - Total meets across all years
   * @property {number} earliest_year - Earliest year on record
   * @property {number} latest_year - Latest year on record
   * @property {FederationYearStat[]} meets_by_year - Per-year meet count
   */

  /**
   * Federation stats response
   * @typedef {object} FederationStatsResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {FederationStatsData} data - Federation stats
   */

  /**
   * GET /api/federations/{federation}/stats
   * @tags Federations
   * @summary Get a federation's meet count by year
   * @description Returns aggregated stats for a federation: total meets, earliest and latest year on record, and a per-year breakdown of meet count.
   * @security BearerAuth
   * @param {string} federation.path.required - Federation slug (e.g., usapl, ipf, uspa)
   * @return {FederationStatsResponse} 200 - Federation stats
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Federation not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   */
  router.get(
    "/api/federations/:federation/stats",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getFederationsParamValidation,
    }),
    async (req: Request<GetFederationsParamType>, res: Response) => {
      const result = await federationService.getFederationStats(req.params.federation);

      if (!result.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: result.data,
      });
    },
  );

  /**
   * GET /api/federations/{federation}
   * @tags Federations
   * @summary Get meets for a specific federation
   * @description Returns meet results for a specific federation, optionally filtered by year
   * @security BearerAuth
   * @param {string} federation.path.required - Federation code (e.g., ipf, usapl, uspa, wrpf)
   * @param {number} year.query - Filter results by competition year (e.g., 2024)
   * @return {FederationsResponse} 200 - Success response with federation results
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Federation not found
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations/ipf",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"meetname": "World Championships", "date": "2024-06-15"}]
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations/ipf",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 404 - Federation not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations/nonexistent",
   *   "message": "The resource cannot be found!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations/ipf",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/federations/:federation",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getFederationsParamValidation,
      query: getFederationsQueryValidation,
    }),
    async (req: Request<GetFederationsParamType, {}, GetFederationsQueryType>, res: Response) => {
      const federations = await federationService.getFederation({ ...req.params, ...req.query });

      if (!federations?.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: federations?.data,
      });
    },
  );

  return router;
}
