import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createFederationsService } from "./federations.service";
import {
  getFederationMeetsQueryValidation,
  getFederationsParamValidation,
  getFederationsValidation,
} from "./federations.validation";

/**
 * Pagination info
 * @typedef {object} Pagination
 * @property {number} current_page - Current page number
 * @property {number} per_page - Items per page
 * @property {number} from - Starting item index (1-based)
 * @property {number} to - Ending item index (inclusive)
 * @property {number} items - Total items across all pages
 * @property {number} pages - Total page count
 * @property {number} first_page - First page number (always 1)
 * @property {number} last_page - Last page number
 */

/**
 * A federation row
 * @typedef {object} FederationRow
 * @property {string} slug - URL-safe lower/alphanumeric slug ("wrpfuk")
 * @property {string} code - Original federation code ("WRPF-UK")
 * @property {string} parent_slug - Slug of the parent federation, or null
 * @property {number} meet_count - Number of meets held under this federation
 */

/**
 * A meet summary
 * @typedef {object} FederationMeet
 * @property {string} path - Canonical meet path ("wrpf/2024-05-12/wrpfamericanpro")
 * @property {string} meet_name - As reported in the CSV
 * @property {string} date - ISO 8601 date
 * @property {string} country - Country code
 * @property {string} state - State/region (if any)
 * @property {string} town - Town (if any)
 * @property {boolean} sanctioned - Whether the meet was federation-sanctioned
 */

/**
 * Federation detail (slug + its meets)
 * @typedef {object} FederationDetail
 * @property {string} slug - Federation slug
 * @property {string} code - Original federation code
 * @property {string} parent_slug - Parent slug or null
 * @property {number} meet_count - Number of meets returned (may differ from total if filtered)
 * @property {FederationMeet[]} meets - Meets, sorted by date desc
 */

/**
 * Federation year stat
 * @typedef {object} FederationYearStat
 * @property {number} year - Calendar year
 * @property {number} meet_count - Number of meets held this year
 */

/**
 * Federation stats payload
 * @typedef {object} FederationStats
 * @property {string} slug - Federation slug
 * @property {string} code - Original federation code
 * @property {string} parent_slug - Parent slug or null
 * @property {number} total_meets - Total meets across all years
 * @property {FederationYearStat[]} meets_by_year - Year buckets, sorted descending
 */

/**
 * Federations list response
 * @typedef {object} FederationsResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {FederationRow[]} data - One row per federation
 * @property {Pagination} pagination - Pagination metadata
 */

/**
 * Federation detail response
 * @typedef {object} FederationDetailResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {FederationDetail} data - Federation + its meets
 */

/**
 * Federation stats response
 * @typedef {object} FederationStatsResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {FederationStats} data - Year-bucketed meet counts
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
  const federationsService = createFederationsService(context.store);
  const router = express.Router();

  /**
   * GET /api/federations
   * @tags Federations
   * @summary Get all federations with optional pagination
   * @description Paginated list of every federation present in the snapshot, sorted by meet count descending.
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @return {FederationsResponse} 200 - Success response with federations list
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations?current_page=1&per_page=3",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     { "slug": "thspa", "code": "THSPA", "parent_slug": null, "meet_count": 6580 },
   *     { "slug": "usapl", "code": "USAPL", "parent_slug": null, "meet_count": 5480 },
   *     { "slug": "uspa", "code": "USPA", "parent_slug": "ipl", "meet_count": 3938 }
   *   ],
   *   "pagination": { "current_page": 1, "per_page": 3, "items": 465 }
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
  router.get("/api/federations", (req: Request, res: Response) => {
    const query = getFederationsValidation.parse(req.query);
    const { data, pagination } = federationsService.getFederations(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/federations/{federation}/stats
   * @tags Federations
   * @summary Get a federation's meet count by year
   * @description Returns per-year meet counts for the requested federation, sorted by year descending. Useful for activity timelines.
   * @param {string} federation.path.required - Federation slug (e.g. "wrpf", "usapl")
   * @return {FederationStatsResponse} 200 - Year-bucketed counts
   * @return {ErrorResponse} 404 - Unknown federation slug
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations/usapl/stats",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "slug": "usapl",
   *     "code": "USAPL",
   *     "parent_slug": null,
   *     "total_meets": 5480,
   *     "meets_by_year": [
   *       { "year": 2026, "meet_count": 177 },
   *       { "year": 2025, "meet_count": 487 }
   *     ]
   *   }
   * }
   * @example response - 404 - Federation not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations/imaginary/stats",
   *   "message": "Federation \"imaginary\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/federations/:federation/stats", (req: Request, res: Response) => {
    const { federation } = getFederationsParamValidation.parse(req.params);
    const stats = federationsService.getFederationStats(federation);
    if (stats == null) throw new NotFoundError(`Federation "${federation}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: stats,
    });
  });

  /**
   * GET /api/federations/{federation}
   * @tags Federations
   * @summary Get meets for a specific federation
   * @description Returns the federation summary plus every meet held under it, optionally narrowed to a single year. Meets are sorted by date descending.
   * @param {string} federation.path.required - Federation slug (e.g. "wrpf", "usapl")
   * @param {number} year.query - Limit meets to a single 4-digit year
   * @return {FederationDetailResponse} 200 - Federation + meets
   * @return {ErrorResponse} 404 - Unknown federation slug
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/federations/wrpf?year=2024",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "slug": "wrpf",
   *     "code": "WRPF",
   *     "parent_slug": null,
   *     "meet_count": 1,
   *     "meets": [
   *       {
   *         "path": "wrpf/2024-05-12/wrpfamericanpro",
   *         "meet_name": "WRPF AMERICAN PRO",
   *         "date": "2024-05-12",
   *         "country": "USA",
   *         "state": "CA",
   *         "town": null,
   *         "sanctioned": true
   *       }
   *     ]
   *   }
   * }
   * @example response - 404 - Federation not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/federations/imaginary",
   *   "message": "Federation \"imaginary\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/federations/:federation", (req: Request, res: Response) => {
    const { federation } = getFederationsParamValidation.parse(req.params);
    const query = getFederationMeetsQueryValidation.parse(req.query);
    const detail = federationsService.getFederation(federation, query);
    if (detail == null) throw new NotFoundError(`Federation "${federation}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: detail,
    });
  });

  return router;
}
