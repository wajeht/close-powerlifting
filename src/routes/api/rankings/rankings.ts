import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createRankingService } from "./rankings.service";
import {
  getRankingsValidation,
  getRankValidation,
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  GetRankingsType,
  GetRankType,
  GetFilteredRankingsParamType,
  GetFilteredRankingsQueryType,
} from "./rankings.validation";

/**
 * A ranking entry
 * @typedef {object} RankingEntry
 * @property {number} rank - Global rank position
 * @property {string} name - Athlete name
 * @property {string} sex - M or F
 * @property {string} equipment - Equipment type (Raw, Wraps, Single-ply, etc.)
 * @property {number} bodyweight_kg - Bodyweight in kg
 * @property {string} weight_class_kg - Weight class
 * @property {number} total_kg - Total lifted in kg
 * @property {number} dots - DOTS score
 * @property {string} federation - Federation code
 * @property {string} date - Competition date
 * @property {string} country - Country code
 */

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
 * Rankings response
 * @typedef {object} RankingsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {RankingEntry[]} data - Array of ranking entries
 * @property {Pagination} pagination - Pagination info
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} data - Empty array
 */

export function createRankingsRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
  );
  const rankingService = createRankingService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/rankings
   * @tags Rankings
   * @summary Get all rankings with optional pagination
   * @description Returns paginated list of all powerlifting rankings sorted by DOTS score
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Success response with rankings data
   * @return {ErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings?current_page=1&per_page=100",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "dots": 617.45}],
   *   "pagination": {"current_page": 1, "per_page": 100, "items": 3000000}
   * }
   */
  router.get(
    "/",
    middleware.apiValidationMiddleware({ query: getRankingsValidation }),
    async (req: Request<{}, {}, GetRankingsType>, res: Response) => {
      const rankings = await rankingService.getRankings(req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}
   * @tags Rankings
   * @summary Filter rankings by equipment type
   * @description Returns rankings filtered by equipment category
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "equipment": "Raw", "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation.pick({ equipment: true }),
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<
        Pick<GetFilteredRankingsParamType, "equipment">,
        {},
        {},
        GetFilteredRankingsQueryType
      >,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}
   * @tags Rankings
   * @summary Filter rankings by equipment and sex
   * @description Returns rankings filtered by equipment category and sex
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "sex": "M", "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment/:sex",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation.pick({ equipment: true, sex: true }),
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<
        Pick<GetFilteredRankingsParamType, "equipment" | "sex">,
        {},
        {},
        GetFilteredRankingsQueryType
      >,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex and weight class
   * @description Returns rankings filtered by equipment, sex and weight class
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "weight_class_kg": "100", "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment/:sex/:weight_class",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation.pick({
        equipment: true,
        sex: true,
        weight_class: true,
      }),
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<
        Pick<GetFilteredRankingsParamType, "equipment" | "sex" | "weight_class">,
        {},
        {},
        GetFilteredRankingsQueryType
      >,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex, weight class and year
   * @description Returns rankings filtered by equipment, sex, weight class and competition year
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "date": "2024-06-15", "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment/:sex/:weight_class/:year",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation.pick({
        equipment: true,
        sex: true,
        weight_class: true,
        year: true,
      }),
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<
        Pick<GetFilteredRankingsParamType, "equipment" | "sex" | "weight_class" | "year">,
        {},
        {},
        GetFilteredRankingsQueryType
      >,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex, weight class, year and event
   * @description Returns rankings filtered by all criteria including event type
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {string} event.path.required - Event type - enum:full-power,bench-only,deadlift-only
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "total_kg": 950, "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment/:sex/:weight_class/:year/:event",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation.pick({
        equipment: true,
        sex: true,
        weight_class: true,
        year: true,
        event: true,
      }),
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<
        Pick<GetFilteredRankingsParamType, "equipment" | "sex" | "weight_class" | "year" | "event">,
        {},
        {},
        GetFilteredRankingsQueryType
      >,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}
   * @tags Rankings
   * @summary Get fully filtered rankings with custom sort
   * @description Returns rankings filtered by all criteria with custom sort order
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {string} event.path.required - Event type - enum:full-power,bench-only,deadlift-only
   * @param {string} sort.path.required - Sort by - enum:by-dots,by-total,by-squat,by-bench,by-deadlift
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/by-dots",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"rank": 1, "name": "John Haack", "dots": 617.45}]
   * }
   */
  router.get(
    "/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
    middleware.apiValidationMiddleware({
      params: getFilteredRankingsParamValidation,
      query: getFilteredRankingsQueryValidation,
    }),
    async (
      req: Request<GetFilteredRankingsParamType, {}, {}, GetFilteredRankingsQueryType>,
      res: Response,
    ) => {
      const rankings = await rankingService.getFilteredRankings(req.params, req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: rankings?.cache,
        data: rankings?.data,
        pagination: rankings?.pagination,
      });
    },
  );

  /**
   * GET /api/rankings/{rank}
   * @tags Rankings
   * @summary Get a single ranking by position
   * @description Returns a single ranking entry by its position number
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {number} rank.path.required - Ranking position (1-based)
   * @return {RankingsResponse} 200 - Single ranking entry
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Ranking not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/1",
   *   "message": "The resource was returned successfully!",
   *   "data": {"rank": 1, "name": "John Haack", "dots": 617.45}
   * }
   */
  router.get(
    "/:rank",
    middleware.apiValidationMiddleware({ params: getRankValidation }),
    async (req: Request<GetRankType, {}, {}>, res: Response) => {
      const rank = await rankingService.getRank(req.params);

      if (!rank) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: rank,
      });
    },
  );

  return router;
}
