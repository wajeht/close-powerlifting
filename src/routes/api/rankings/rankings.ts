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
 * @property {RankingEntry[]} data - Array of ranking entries
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

export function createRankingsRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
    context.apiCallLogRepository,
  );
  const rankingService = createRankingService(context.knex, context.scraper);

  const router = express.Router();

  /**
   * GET /api/rankings
   * @tags Rankings
   * @summary Get all rankings with optional pagination
   * @description Returns paginated list of all powerlifting rankings sorted by DOTS score
   * @security BearerAuth
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @return {RankingsResponse} 200 - Success response with rankings data
   * @return {ErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {ErrorResponse} 400 - Validation error - Invalid query parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings?current_page=1&per_page=100",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "dots": 617.45}],
   *   "pagination": {"current_page": 1, "per_page": 100, "items": 3000000}
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getRankingsValidation }),
    async (req: Request<{}, {}, GetRankingsType>, res: Response) => {
      const rankings = await rankingService.getRankings(req.query);

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "equipment": "Raw", "dots": 617.45}]
   * }
   * @example response - 400 - Invalid equipment value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/invalid",
   *   "message": "Invalid enum value. Expected 'raw' | 'wraps' | 'raw-wraps' | 'single-ply' | 'multi-ply' | 'unlimited', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["equipment"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "sex": "M", "dots": 617.45}]
   * }
   * @example response - 400 - Invalid parameter value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/invalid",
   *   "message": "Invalid enum value. Expected 'men' | 'women', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["sex"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "weight_class_kg": "100", "dots": 617.45}]
   * }
   * @example response - 400 - Invalid parameter value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/invalid/men/100",
   *   "message": "Invalid enum value. Expected 'raw' | 'wraps' | 'raw-wraps' | 'single-ply' | 'multi-ply' | 'unlimited', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["equipment"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "date": "2024-06-15", "dots": 617.45}]
   * }
   * @example response - 400 - Invalid parameter value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/invalid/men/100/2024",
   *   "message": "Invalid enum value. Expected 'raw' | 'wraps' | 'raw-wraps' | 'single-ply' | 'multi-ply' | 'unlimited', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["equipment"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {string} event.path.required - Event type - enum:full-power,push-pull,squat,bench,deadlift
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "total_kg": 950, "dots": 617.45}]
   * }
   * @example response - 400 - Invalid parameter value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/invalid",
   *   "message": "Invalid enum value. Expected 'full-power' | 'push-pull' | 'squat' | 'bench' | 'deadlift', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["event"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class (e.g., 75, 90, 100)
   * @param {string} year.path.required - Competition year (e.g., 2024)
   * @param {string} event.path.required - Event type - enum:full-power,push-pull,squat,bench,deadlift
   * @param {string} sort.path.required - Sort by - enum:by-dots,by-wilks,by-glossbrenner,by-goodlift,by-mcculloch,by-total,by-squat,by-bench,by-deadlift
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @param {string} federation.query - Federation code to filter by (e.g., uspa, ipf, wrpf)
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 400 - Validation error - Invalid parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/by-dots",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"rank": 1, "name": "John Haack", "dots": 617.45}]
   * }
   * @example response - 400 - Invalid parameter value
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/invalid",
   *   "message": "Invalid enum value. Expected 'by-dots' | 'by-wilks' | 'by-glossbrenner' | 'by-goodlift' | 'by-mcculloch' | 'by-total' | 'by-squat' | 'by-bench' | 'by-deadlift', received 'invalid'",
   *   "errors": [{"code": "invalid_enum_value", "path": ["sort"], "message": "Invalid enum value"}],
   *   "data": []
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/by-dots",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/by-dots",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
   * @param {number} rank.path.required - Ranking position (1-based)
   * @return {RankingsResponse} 200 - Single ranking entry
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Ranking not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/1",
   *   "message": "The resource was returned successfully!",
   *   "data": {"rank": 1, "name": "John Haack", "dots": 617.45}
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/1",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 404 - Ranking not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/99999999",
   *   "message": "The resource cannot be found!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/1",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/rankings/:rank",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
