import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { Units } from "../../../utils/helpers";
import { createUsersService } from "./users.service";
import {
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.validation";

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
 * A lifter search match
 * @typedef {object} LifterMatch
 * @property {string} username - Username slug
 * @property {string} name - Lifter name
 */

/**
 * Personal best metrics for one equipment group / lifter
 * @typedef {object} PersonalBest
 * @property {number} squat - Best squat in requested units
 * @property {number} bench - Best bench in requested units
 * @property {number} deadlift - Best deadlift in requested units
 * @property {number} total - Best total in requested units
 * @property {number} dots - Best DOTS (unitless)
 * @property {number} wilks - Best Wilks (unitless)
 * @property {string} units - Echoes the units used
 */

/**
 * Competition result row
 * @typedef {object} CompetitionResult
 * @property {string} date - Meet date
 * @property {string} meet_name - Meet name
 * @property {string} meet_path - Canonical meet path
 * @property {string} federation - Federation code
 * @property {string} event - SBD / BD / SD / SB / S / B / D
 * @property {string} equipment - Equipment category
 * @property {number} weight_class_kg - Weight class
 * @property {number} bodyweight - In requested units
 * @property {number} squat - Best squat in requested units
 * @property {number} bench - Best bench in requested units
 * @property {number} deadlift - Best deadlift in requested units
 * @property {number} total - Total in requested units
 * @property {number} dots - DOTS
 * @property {string} place - Numeric rank or status code
 * @property {string} units - Echoes the units used
 * @property {object} attempts - Squat/bench/deadlift 4-attempt arrays (only when ?include_attempts=true)
 */

/**
 * Athlete profile + history
 * @typedef {object} UserProfile
 * @property {string} username - Username slug
 * @property {string} name - Lifter name
 * @property {number} total_entries - Total entries across all meets
 * @property {string} first_meet - Date of earliest meet
 * @property {string} last_meet - Date of most recent meet
 * @property {PersonalBest} personal_best - Career bests
 * @property {CompetitionResult[]} competition_results - All entries, newest first
 */

/**
 * Per-equipment personal bests rollup
 * @typedef {object} PersonalBestsByEquipment
 * @property {string} username - Username slug
 * @property {string} name - Lifter name
 * @property {number} total_meets - Total entries
 * @property {object[]} by_equipment - One row per equipment category with `equipment`, `meets`, `personal_best`
 */

/**
 * Progression payload
 * @typedef {object} ProgressionData
 * @property {string} username - Username slug
 * @property {string} name - Lifter name
 * @property {number} meets - Total meets in the progression
 * @property {object[]} progression - Chronological entries with a `running_pb` rollup at each step
 */

/**
 * Per-metric rank rollup
 * @typedef {object} UserRank
 * @property {string} username - Username slug
 * @property {string} name - Lifter name
 * @property {object} ranks - Map of metric → `{ rank, out_of }` (or null if not eligible for that metric)
 */

/**
 * Compare payload
 * @typedef {object} CompareData
 * @property {object} a - Profile summary for username `a`
 * @property {object} b - Profile summary for username `b`
 * @property {object} deltas - { squat, bench, deadlift, total, dots } — `a - b`, in requested units
 */

/**
 * Users search response (paginated)
 * @typedef {object} UsersListResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {LifterMatch[]} data - Matching lifters
 * @property {Pagination} pagination - Pagination metadata
 */

/**
 * User profile response
 * @typedef {object} UserResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {UserProfile} data - Profile + history
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

export function createUsersRouter(context: AppContext) {
  const usersService = createUsersService(context.store);
  const router = express.Router();

  /**
   * GET /api/users
   * @tags Users
   * @summary Search for athletes or return total lifter count
   * @description Without `?search=`, returns the total number of lifters in the snapshot and a usage hint. With `?search=`, performs a case-insensitive substring match across name + username and returns paginated results. The search is a linear scan over ~1 M lifters — typically 5-30 ms.
   * @param {string} search.query - Case-insensitive substring matched against name + username
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @return {UsersListResponse} 200 - Search hits or summary
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Search hits
   * {
   *   "status": "success",
   *   "request_url": "/api/users?search=haack",
   *   "message": "The resource was returned successfully!",
   *   "data": [ { "username": "johnhaack", "name": "John Haack" } ],
   *   "pagination": { "current_page": 1, "per_page": 100, "items": 1 }
   * }
   * @example response - 200 - No search term (summary)
   * {
   *   "status": "success",
   *   "request_url": "/api/users",
   *   "message": "The resource was returned successfully!",
   *   "data": { "total_lifters": 1003428, "message": "Pass ?search=<query>..." }
   * }
   */
  router.get("/api/users", (req: Request, res: Response) => {
    const query = getUsersValidation.parse(req.query);
    const { data, pagination } = usersService.searchOrSummary(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      ...(pagination ? { pagination } : {}),
    });
  });

  /**
   * GET /api/users/compare
   * @tags Users
   * @summary Compare two athletes side-by-side
   * @description Returns the profile summary for two lifters plus numeric deltas (`a - b`) on squat / bench / deadlift / total / dots. Both `a` and `b` are required.
   * @param {string} a.query.required - Username slug for the first lifter
   * @param {string} b.query.required - Username slug for the second lifter
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @return {object} 200 - Side-by-side comparison
   * @return {ErrorResponse} 400 - Validation error (missing a or b, invalid slug)
   * @return {ErrorResponse} 404 - One of the lifters not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/compare?a=edcoan&b=johnsmith1",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "a": { "username": "edcoan", "name": "Ed Coan", "personal_best": { "total": 1080 } },
   *     "b": { "username": "johnsmith1", "name": "John Smith #1", "personal_best": { "total": 970 } },
   *     "deltas": { "total": 110 }
   *   }
   * }
   * @example response - 404 - Lifter not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/users/compare?a=edcoan&b=nobody",
   *   "message": "Lifter \"nobody\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/users/compare", (req: Request, res: Response) => {
    const query = getCompareValidation.parse(req.query);
    const result = usersService.compare(query);
    if (!result.found) {
      const missing = result.missing === "a" ? query.a : query.b;
      throw new NotFoundError(`Lifter "${missing}" not found`);
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result.data,
    });
  });

  /**
   * GET /api/users/{username}/progression
   * @tags Users
   * @summary Get an athlete's competition progression over time
   * @description Returns every entry sorted chronologically (oldest first) with a running personal-best rollup at each step — useful for charts. Weight values respect the `units` query.
   * @param {string} username.path.required - Username slug
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @return {object} 200 - Chronological progression
   * @return {ErrorResponse} 404 - Lifter not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack/progression",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "username": "johnhaack",
   *     "name": "John Haack",
   *     "meets": 34,
   *     "progression": [
   *       { "date": "2013-06-15", "total": 672.5, "running_pb": { "total": 672.5 } }
   *     ]
   *   }
   * }
   */
  router.get("/api/users/:username/progression", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const data = usersService.getProgression(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}/personal-bests
   * @tags Users
   * @summary Get an athlete's personal bests grouped by equipment
   * @description Returns career bests bucketed by equipment category (Raw / Wraps / Single-ply / Multi-ply / Unlimited / Straps), one row per equipment the lifter has entered in.
   * @param {string} username.path.required - Username slug
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @return {object} 200 - PBs by equipment
   * @return {ErrorResponse} 404 - Lifter not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack/personal-bests",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "username": "johnhaack",
   *     "name": "John Haack",
   *     "total_meets": 34,
   *     "by_equipment": [
   *       { "equipment": "Raw", "meets": 33, "personal_best": { "squat": 372.5, "bench": 272.5, "deadlift": 426, "total": 1043.5, "dots": 665.75 } }
   *     ]
   *   }
   * }
   */
  router.get("/api/users/:username/personal-bests", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const data = usersService.getPersonalBests(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}/rank
   * @tags Users
   * @summary Get an athlete's global ranking
   * @description Returns the lifter's global rank on each of the eight scoring metrics (dots, wilks, glossbrenner, goodlift, total, squat, bench, deadlift). `null` for any metric the lifter has no eligible entry on. Implemented as a linear scan over the precomputed rank arrays — ~3-5 ms per metric.
   * @param {string} username.path.required - Username slug
   * @return {object} 200 - Per-metric ranks
   * @return {ErrorResponse} 404 - Lifter not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack/rank",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "username": "johnhaack",
   *     "name": "John Haack",
   *     "ranks": {
   *       "dots": { "rank": 167, "out_of": 954614 },
   *       "wilks": { "rank": 213, "out_of": 954614 }
   *     }
   *   }
   * }
   */
  router.get("/api/users/:username/rank", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const data = usersService.getRank(username);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}
   * @tags Users
   * @summary Get athlete profile by username
   * @description Returns the lifter's profile summary (career PBs, first/last meet) plus every entry sorted by date desc. Pass `?include_attempts=true` to include 4-attempt arrays for each entry.
   * @param {string} username.path.required - Username slug
   * @param {string} include_attempts.query - Include squat/bench/deadlift 4-attempt arrays - enum:true,false
   * @param {string} units.query - Unit system - enum:lbs,kg
   * @return {UserResponse} 200 - Profile + competition history
   * @return {ErrorResponse} 404 - Lifter not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/edcoan",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "username": "edcoan",
   *     "name": "Ed Coan",
   *     "total_entries": 2,
   *     "first_meet": "2024-05-12",
   *     "last_meet": "2024-09-01",
   *     "personal_best": { "squat": 410, "bench": 270, "deadlift": 400, "total": 1080 }
   *   }
   * }
   * @example response - 404 - Lifter not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/users/nobody",
   *   "message": "Lifter \"nobody\" not found",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get("/api/users/:username", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const query = getUserQueryValidation.parse(req.query);
    const data = usersService.getUser(username, query);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  return router;
}
