import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getRankings, getRank, getFilteredRankings } from "./rankings.service";
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

const rankingsRouter = express.Router();

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
 * @property {number} total - Total items
 * @property {number} last_page - Last page number
 */

/**
 * Rankings response
 * @typedef {object} RankingsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {array<RankingEntry>} data - Array of ranking entries
 * @property {Pagination} pagination - Pagination info
 */

/**
 * GET /api/rankings
 * @tags Rankings
 * @summary Get all rankings with optional pagination
 * @description Returns paginated list of all powerlifting rankings sorted by DOTS score
 * @security BearerAuth
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with rankings data
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/rankings?current_page=1&per_page=100",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": [{"rank": 1, "name": "John Haack", "dots": 617.45}],
 *   "pagination": {"current_page": 1, "per_page": 100, "total": 3000000}
 * }
 */
rankingsRouter.get(
  "/",
  apiValidationMiddleware({ query: getRankingsValidation }),
  async (req: Request<{}, {}, GetRankingsType>, res: Response) => {
    const rankings = await getRankings(req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @description Returns rankings filtered by equipment type (raw, wraps, single-ply, etc.)
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment",
  apiValidationMiddleware({
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
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @description Returns rankings filtered by equipment type and sex (men/women)
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment/:sex",
  apiValidationMiddleware({
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
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @summary Filter rankings by equipment, sex, and weight class
 * @description Returns rankings filtered by equipment, sex, and weight class
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {string} weight_class.path.required - Weight class in kg (e.g., 100, 140+)
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment/:sex/:weight_class",
  apiValidationMiddleware({
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
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @summary Filter rankings by equipment, sex, weight class, and year
 * @description Returns rankings filtered by equipment, sex, weight class, and competition year
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {string} weight_class.path.required - Weight class in kg (e.g., 100, 140+)
 * @param {string} year.path.required - Competition year (e.g., 2024)
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment/:sex/:weight_class/:year",
  apiValidationMiddleware({
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
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @summary Filter rankings by equipment, sex, weight class, year, and event
 * @description Returns rankings filtered by all criteria including event type
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {string} weight_class.path.required - Weight class in kg (e.g., 100, 140+)
 * @param {string} year.path.required - Competition year (e.g., 2024)
 * @param {string} event.path.required - Event type - enum:full-power,push-pull,squat,bench,deadlift
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment/:sex/:weight_class/:year/:event",
  apiValidationMiddleware({
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
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @summary Filter rankings with all parameters including sort order
 * @description Returns rankings filtered by all criteria with custom sort order
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {string} weight_class.path.required - Weight class in kg (e.g., 100, 140+)
 * @param {string} year.path.required - Competition year (e.g., 2024)
 * @param {string} event.path.required - Event type - enum:full-power,push-pull,squat,bench,deadlift
 * @param {string} sort.path.required - Sort order - enum:by-dots,by-wilks,by-glossbrenner,by-total,by-squat,by-bench,by-deadlift
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {RankingsResponse} 200 - Success response with filtered rankings
 */
rankingsRouter.get(
  "/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
  apiValidationMiddleware({
    params: getFilteredRankingsParamValidation,
    query: getFilteredRankingsQueryValidation,
  }),
  async (
    req: Request<GetFilteredRankingsParamType, {}, {}, GetFilteredRankingsQueryType>,
    res: Response,
  ) => {
    const rankings = await getFilteredRankings(req.params, req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
 * @summary Get specific rank by position
 * @description Returns details for a specific rank position in the global rankings
 * @security BearerAuth
 * @param {number} rank.path.required - The rank position to look up (e.g., 1, 100, 1000)
 * @return {object} 200 - Success response with rank details
 * @return {object} 404 - Rank not found
 */
rankingsRouter.get(
  "/:rank",
  apiValidationMiddleware({ params: getRankValidation }),
  async (req: Request<GetRankType, {}, {}>, res: Response) => {
    const rank = await getRank(req.params);

    if (!rank) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: rank,
    });
  },
);

export { rankingsRouter };
