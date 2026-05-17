import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMeetsService } from "./meets.service";
import {
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.validation";

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
 * Meet summary (list item)
 * @typedef {object} MeetSummary
 * @property {string} path - Canonical meet path ("wrpf/2024-05-12/wrpfamericanpro")
 * @property {string} meet_name - Meet name as reported in the CSV
 * @property {string} federation - Federation code
 * @property {string} date - ISO 8601 date
 * @property {string} country - Country code
 * @property {string} state - State/region
 * @property {string} town - Town
 * @property {boolean} sanctioned - Whether the meet was federation-sanctioned
 */

/**
 * Meet result row
 * @typedef {object} MeetEntry
 * @property {string} username - Lifter username slug
 * @property {string} name - Lifter name
 * @property {string} sex - M, F, or Mx
 * @property {number} age - Age at competition
 * @property {string} event - SBD / BD / SD / SB / S / B / D
 * @property {string} equipment - Equipment category
 * @property {number} weight_class_kg - Weight class (kg). Negative means under-class encoding.
 * @property {number} bodyweight - In requested units (lbs default, kg if ?units=kg)
 * @property {number} squat - Best squat in requested units
 * @property {number} bench - Best bench in requested units
 * @property {number} deadlift - Best deadlift in requested units
 * @property {number} total - Total in requested units
 * @property {number} dots - DOTS score (unitless)
 * @property {string} place - Numeric rank or status code (G/DQ/DD/NS)
 * @property {string} units - Echoes the units used ("lbs" or "kg")
 */

/**
 * Meet detail payload
 * @typedef {object} MeetDetail
 * @property {string} path - Canonical meet path
 * @property {string} meet_name - Meet name
 * @property {string} federation - Federation code
 * @property {string} parent_federation - Parent federation, if any
 * @property {string} date - ISO 8601 date
 * @property {string} country - Country code
 * @property {string} state - State/region
 * @property {string} town - Town
 * @property {boolean} sanctioned - Federation-sanctioned flag
 * @property {MeetEntry[]} results - Entries, sorted per ?sort query
 */

/**
 * Best-of summary for one metric
 * @typedef {object} MeetHighlightBest
 * @property {string} username - Lifter username slug
 * @property {string} name - Lifter name
 * @property {string} equipment - Equipment category
 * @property {number} weight_class_kg - Weight class
 * @property {number} value - Lift value in requested units (raw value for `best_dots`)
 */

/**
 * Meet highlights payload
 * @typedef {object} MeetHighlights
 * @property {string} path - Canonical meet path
 * @property {string} meet_name - Meet name
 * @property {string} federation - Federation code
 * @property {string} date - ISO 8601 date
 * @property {object} highlights - { best_total, best_squat, best_bench, best_deadlift, best_dots }
 */

/**
 * Meets list response
 * @typedef {object} MeetsListResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {MeetSummary[]} data - Meet summaries
 * @property {Pagination} pagination - Pagination metadata
 */

/**
 * Meet detail response
 * @typedef {object} MeetDetailResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {MeetDetail} data - Meet + results
 */

/**
 * Meet highlights response
 * @typedef {object} MeetHighlightsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {MeetHighlights} data - Best-of-meet rollup
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

export function createMeetsRouter(context: AppContext) {
  const meetsService = createMeetsService(context.store);
  const router = express.Router();

  /**
   * GET /api/meets
   * @tags Meets
   * @summary List meets across federations
   * @description Paginated index of meets, sorted by date desc by default. Supports filtering by federation slug, date range, country/state, and a case-insensitive name search.
   * @param {string} federation.query - Federation slug (e.g. "wrpf", "usapl")
   * @param {string} from.query - ISO date lower bound (inclusive)
   * @param {string} to.query - ISO date upper bound (inclusive)
   * @param {string} country.query - Country code exact match
   * @param {string} state.query - State/region exact match
   * @param {string} search.query - Case-insensitive substring match on meet_name
   * @param {string} sort.query - "date-desc" (default) or "date-asc" - enum:date-desc,date-asc
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @return {MeetsListResponse} 200 - Meet summaries
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/meets?per_page=2",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "path": "apla/2026-05-10/statechampionships",
   *       "meet_name": "State Championships",
   *       "federation": "APLA",
   *       "date": "2026-05-10",
   *       "country": "Australia",
   *       "state": "VIC",
   *       "town": null,
   *       "sanctioned": true
   *     }
   *   ],
   *   "pagination": { "current_page": 1, "per_page": 2, "items": 61808 }
   * }
   */
  router.get("/api/meets", (req: Request, res: Response) => {
    const query = listMeetsQueryValidation.parse(req.query);
    const { data, pagination } = meetsService.listMeets(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}/highlights
   * @tags Meets
   * @summary Get meet highlights
   * @description Returns the best lift in each category (total, squat, bench, deadlift, dots) for a single meet. Useful for headline cards. Weight values respect the `units` query.
   * @param {string} federation.path.required - Federation slug component of the meet path
   * @param {string} date.path.required - ISO date component of the meet path
   * @param {string} slug.path.required - Slug component of the meet path
   * @param {string} units.query - Unit system (lbs default, kg) - enum:lbs,kg
   * @return {MeetHighlightsResponse} 200 - Best-of rollup
   * @return {ErrorResponse} 404 - Meet path not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/meets/wpo/2024-10-11/profinals/highlights?units=kg",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "path": "wpo/2024-10-11/profinals",
   *     "meet_name": "Pro Finals",
   *     "federation": "WPO",
   *     "date": "2024-10-11",
   *     "highlights": {
   *       "best_total": { "username": "davehoff1", "name": "Dave Hoff #1", "equipment": "Multi-ply", "weight_class_kg": 140, "value": 1350 }
   *     }
   *   }
   * }
   * @example response - 404 - Meet not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/meets/wrpf/9999-01-01/ghost/highlights",
   *   "message": "Meet \"wrpf/9999-01-01/ghost\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/meets/:federation/:date/:slug/highlights", (req: Request, res: Response) => {
    const params = getMeetParamValidation.parse(req.params);
    const query = getMeetHighlightsQueryValidation.parse(req.query);
    const result = meetsService.getMeetHighlights(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result,
    });
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}
   * @tags Meets
   * @summary Get meet results
   * @description Returns the meet header plus every entry, sorted per `?sort=` (place|by-total|by-dots). Weight values respect the `units` query.
   * @param {string} federation.path.required - Federation slug component
   * @param {string} date.path.required - ISO date component
   * @param {string} slug.path.required - Slug component
   * @param {string} sort.query - Result ordering - enum:place,by-total,by-dots
   * @param {string} units.query - Unit system (lbs default, kg) - enum:lbs,kg
   * @return {MeetDetailResponse} 200 - Meet + results
   * @return {ErrorResponse} 404 - Meet path not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/meets/wrpf/2024-05-12/wrpfamericanpro?units=kg",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "path": "wrpf/2024-05-12/wrpfamericanpro",
   *     "meet_name": "WRPF AMERICAN PRO",
   *     "federation": "WRPF",
   *     "date": "2024-05-12",
   *     "country": "USA",
   *     "results": [
   *       { "username": "edcoan", "name": "Ed Coan", "sex": "M", "event": "SBD", "equipment": "Raw", "weight_class_kg": 100, "bodyweight": 99.5, "squat": 410, "bench": 270, "deadlift": 400, "total": 1080, "dots": 700, "place": 1, "units": "kg" }
   *     ]
   *   }
   * }
   * @example response - 404 - Meet not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/meets/wrpf/9999-01-01/ghost",
   *   "message": "Meet \"wrpf/9999-01-01/ghost\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/meets/:federation/:date/:slug", (req: Request, res: Response) => {
    const params = getMeetParamValidation.parse(req.params);
    const query = getMeetQueryValidation.parse(req.query);
    const result = meetsService.getMeet(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result,
    });
  });

  return router;
}
