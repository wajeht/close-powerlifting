import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createRankingsService } from "./rankings.service";
import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.validation";

/**
 * Pagination info
 * @typedef {object} Pagination
 * @property {number} current_page - Current page number
 * @property {number} per_page - Items per page
 * @property {number} from - Starting item index (1-based)
 * @property {number} to - Ending item index (inclusive)
 * @property {number} items - Total items across all pages
 * @property {number} pages - Total page count
 * @property {number} first_page - First page number
 * @property {number} last_page - Last page number
 */

/**
 * A ranking entry
 * @typedef {object} RankingEntry
 * @property {number} rank - Global rank position (1-based)
 * @property {string} username - Lifter username slug
 * @property {string} name - Lifter name
 * @property {string} sex - M, F, or Mx
 * @property {number} age - Age at the entry's meet
 * @property {number} bodyweight - In requested units (lbs default, kg if ?units=kg)
 * @property {number} weight_class_kg - Weight class. Negative = under-class encoding.
 * @property {string} equipment - Raw / Wraps / Single-ply / Multi-ply / Unlimited / Straps
 * @property {string} event - SBD / BD / SD / SB / S / B / D
 * @property {number} squat - Best squat in requested units
 * @property {number} bench - Best bench in requested units
 * @property {number} deadlift - Best deadlift in requested units
 * @property {number} total - Total in requested units
 * @property {number} dots - DOTS score (unitless)
 * @property {number} wilks - Wilks score (unitless)
 * @property {number} glossbrenner - Glossbrenner score (unitless)
 * @property {number} goodlift - Goodlift score (unitless)
 * @property {string} federation - Federation code
 * @property {string} meet_path - Canonical meet path
 * @property {string} meet_name - Meet name
 * @property {string} meet_date - Meet date (ISO 8601)
 * @property {string} country - Lifter country code
 * @property {string} units - Echoes the units used ("lbs" or "kg")
 */

/**
 * Rankings list response
 * @typedef {object} RankingsResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {RankingEntry[]} data - Ranked lifters
 * @property {Pagination} pagination - Pagination metadata
 */

/**
 * Single ranking response
 * @typedef {object} RankingResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {RankingEntry} data - One lifter
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} errors - Error details
 * @property {object[]} data - Empty array
 */

export function createRankingsRouter(context: AppContext) {
  const rankingsService = createRankingsService(context.store);
  const router = express.Router();

  /**
   * GET /api/rankings
   * @tags Rankings
   * @summary Get all rankings with optional pagination
   * @description Returns the global rankings sorted by DOTS, paginated. With `?federation=` the result is narrowed to lifters whose best DOTS entry was scored under that federation (linear scan over entries; still sub-100 ms).
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter (e.g. uspa, ipf, wrpf)
   * @return {RankingsResponse} 200 - Success response with rankings data
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings?per_page=2",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     { "rank": 1, "username": "deanatollefson", "name": "Deana Tollefson", "sex": "F", "equipment": "Multi-ply", "total": 885, "dots": 818.06, "federation": "WPO", "meet_path": "wpo/2024-10-11/profinals" }
   *   ],
   *   "pagination": { "current_page": 1, "per_page": 2, "items": 954614 }
   * }
   */
  router.get("/api/rankings", (req: Request, res: Response) => {
    const query = getRankingsValidation.parse(req.query);
    const { data, pagination } = rankingsService.getRankings(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}
   * @tags Rankings
   * @summary Get fully filtered rankings with custom sort
   * @description Filters entries by every dimension and sorts by the chosen metric. Each lifter contributes their single best entry that matches the filter. Note: `by-mcculloch` falls back to DOTS internally because the OPL bulk CSV no longer ships a McCulloch column.
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class in kg (e.g. "75", "90", "100")
   * @param {string} year.path.required - 4-digit year
   * @param {string} event.path.required - Event - enum:full-power,push-pull,squat,bench,deadlift
   * @param {string} sort.path.required - Sort metric - enum:by-dots,by-wilks,by-glossbrenner,by-goodlift,by-mcculloch,by-total,by-squat,by-bench,by-deadlift
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter - enum:24-34,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79
   * @return {RankingsResponse} 200 - Filtered rankings
   * @return {ErrorResponse} 400 - Validation error
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw/men/100/2024/full-power/by-total",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     { "rank": 1, "username": "johnhaack", "name": "John Haack", "weight_class_kg": 100, "total": 1043.5, "dots": 662.39 }
   *   ]
   * }
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
    handleFiltered,
  );

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex, weight class, year and event
   * @description Same as the six-part variant but defaults the sort metric to DOTS.
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class in kg
   * @param {string} year.path.required - 4-digit year
   * @param {string} event.path.required - Event - enum:full-power,push-pull,squat,bench,deadlift
   * @param {number} current_page.query - Page number
   * @param {number} per_page.query - Results per page
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter
   * @return {RankingsResponse} 200 - Filtered rankings
   */
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event", handleFiltered);

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex, weight class and year
   * @param {string} equipment.path.required - Equipment group
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class in kg
   * @param {string} year.path.required - 4-digit year
   * @param {number} current_page.query - Page number
   * @param {number} per_page.query - Results per page
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter
   * @return {RankingsResponse} 200 - Filtered rankings
   */
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class/:year", handleFiltered);

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}
   * @tags Rankings
   * @summary Filter rankings by equipment, sex and weight class
   * @param {string} equipment.path.required - Equipment group
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} weight_class.path.required - Weight class in kg
   * @param {number} current_page.query - Page number
   * @param {number} per_page.query - Results per page
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter
   * @return {RankingsResponse} 200 - Filtered rankings
   */
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class", handleFiltered);

  /**
   * GET /api/rankings/filter/{equipment}/{sex}
   * @tags Rankings
   * @summary Filter rankings by equipment and sex
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {number} current_page.query - Page number
   * @param {number} per_page.query - Results per page
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter
   * @return {RankingsResponse} 200 - Filtered rankings
   */
  router.get("/api/rankings/filter/:equipment/:sex", handleFiltered);

  /**
   * GET /api/rankings/filter/{equipment}
   * @tags Rankings
   * @summary Filter rankings by equipment type
   * @description Returns DOTS-sorted rankings narrowed to one equipment category. `raw-wraps` includes both Raw and Wraps entries.
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
   * @param {number} current_page.query - Page number
   * @param {number} per_page.query - Results per page
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @param {string} federation.query - Federation slug filter
   * @param {string} age_class.query - Age class filter
   * @return {RankingsResponse} 200 - Filtered rankings
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/filter/raw",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     { "rank": 1, "username": "johnhaack", "name": "John Haack", "equipment": "Raw", "dots": 665.75 }
   *   ]
   * }
   */
  router.get("/api/rankings/filter/:equipment", handleFiltered);

  /**
   * GET /api/rankings/{rank}
   * @tags Rankings
   * @summary Get a single ranking by position
   * @description Returns the lifter (and their best DOTS entry) at the requested 1-based global rank.
   * @param {number} rank.path.required - Ranking position (1-based)
   * @return {RankingResponse} 200 - Single ranking entry
   * @return {ErrorResponse} 400 - Rank is not a positive integer
   * @return {ErrorResponse} 404 - Rank exceeds the eligible lifter count
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/rankings/1",
   *   "message": "The resource was returned successfully!",
   *   "data": { "rank": 1, "username": "deanatollefson", "name": "Deana Tollefson", "dots": 818.06 }
   * }
   * @example response - 404 - Rank out of range
   * {
   *   "status": "fail",
   *   "request_url": "/api/rankings/99999999",
   *   "message": "Rank 99999999 is out of range (max=954614)",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/rankings/:rank", (req: Request, res: Response) => {
    const { rank: rawRank } = getRankValidation.parse(req.params);
    const rank = parseInt(rawRank, 10);
    const data = rankingsService.getRank(rank);
    if (data == null) {
      throw new NotFoundError(
        `Rank ${rawRank} is out of range (max=${rankingsService.getMaxRank()})`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  function handleFiltered(req: Request, res: Response): void {
    const params = getFilteredRankingsParamValidation.parse(req.params);
    const query = getFilteredRankingsQueryValidation.parse(req.query);
    const { data, pagination } = rankingsService.getFilteredRankings(params, query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  }

  return router;
}
