import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as RankingsService from "./rankings.service";
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

const router = express.Router();

/**
 * GET /api/rankings
 * @tags rankings
 * @summary get all rankings with optional pagination
 * @security BearerAuth
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getRankingsValidation }),
  async (req: Request<{}, {}, GetRankingsType>, res: Response) => {
    const rankings = await RankingsService.getRankings(req.query);

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
 * @tags rankings
 * @summary get rankings filtered by equipment type
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
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
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get rankings filtered by equipment and sex
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
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
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get rankings filtered by equipment, sex, and weight class
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {string} weight_class.path - weight class: 44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140+
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
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
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get rankings filtered by equipment, sex, weight class, and year
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {string} weight_class.path - weight class: 44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140+
 * @param {string} year.path - competition year (e.g., 2024, 2025)
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
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
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get rankings filtered by equipment, sex, weight class, year, and event
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {string} weight_class.path - weight class: 44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140+
 * @param {string} year.path - competition year (e.g., 2024, 2025)
 * @param {string} event.path - event type: full-power, push-pull, squat, bench, deadlift
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
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
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get rankings with all filters including sort order
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {string} weight_class.path - weight class: 44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140+
 * @param {string} year.path - competition year (e.g., 2024, 2025)
 * @param {string} event.path - event type: full-power, push-pull, squat, bench, deadlift
 * @param {string} sort.path - sort order: by-dots, by-wilks, by-glossbrenner, by-total, by-squat, by-bench, by-deadlift
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
  "/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
  apiValidationMiddleware({
    params: getFilteredRankingsParamValidation,
    query: getFilteredRankingsQueryValidation,
  }),
  async (
    req: Request<GetFilteredRankingsParamType, {}, {}, GetFilteredRankingsQueryType>,
    res: Response,
  ) => {
    const rankings = await RankingsService.getFilteredRankings(req.params, req.query);

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
 * @tags rankings
 * @summary get specific rank details
 * @security BearerAuth
 * @param {string} rank.path.required - the rank number to look up
 * @return {object} 200 - success response
 * @return {object} 404 - not found
 */
router.get(
  "/:rank",
  apiValidationMiddleware({ params: getRankValidation }),
  async (req: Request<GetRankType, {}, {}>, res: Response) => {
    const rank = await RankingsService.getRank(req.params);

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

export default router;
