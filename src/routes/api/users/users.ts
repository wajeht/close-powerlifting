import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createUserService } from "./users.service";
import {
  getUserValidation,
  getUsersValidation,
  getUserQueryValidation,
  getCompareValidation,
  userUnitsQueryValidation,
  GetUserType,
  GetUserQueryType,
  GetUsersType,
  GetCompareType,
  UserUnitsQueryType,
} from "./users.validation";

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
 * Personal best record
 * @typedef {object} PersonalBest
 * @property {string} equipment - Equipment used
 * @property {string} squat - Best squat
 * @property {string} bench - Best bench
 * @property {string} deadlift - Best deadlift
 * @property {string} total - Best total
 * @property {string} dots - Best DOTS score
 */

/**
 * Competition result
 * @typedef {object} CompetitionResult
 * @property {string} place - Placement
 * @property {string} federation - Federation
 * @property {string} date - Competition date
 * @property {string} meetname - Meet name
 * @property {string} equipment - Equipment
 * @property {string} age - Age at competition
 * @property {string} weight_class - Weight class
 * @property {string} bodyweight - Body weight
 * @property {string} squat - Squat result
 * @property {string} bench - Bench result
 * @property {string} deadlift - Deadlift result
 * @property {string} total - Total
 * @property {string} dots - DOTS score
 */

/**
 * User profile
 * @typedef {object} UserProfile
 * @property {string} name - Athlete's full name
 * @property {string} username - Username/slug
 * @property {string} sex - M or F
 * @property {string} instagram - Instagram handle
 * @property {string} instagram_url - Instagram profile URL
 * @property {PersonalBest[]} personal_best - Personal best records
 * @property {CompetitionResult[]} competition_results - Competition history
 */

/**
 * User response
 * @typedef {object} UserResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {UserProfile} data - User profile data
 */

/**
 * User search response
 * @typedef {object} UserSearchResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {object[]} data - Search results
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

export function createUsersRouter(context: AppContext) {
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
  const userService = createUserService(context.knex, context.scraper);

  const router = express.Router();

  /**
   * GET /api/users
   * @tags Users
   * @summary Search for athletes or redirect to rankings
   * @description Searches for athletes by name. If no search query is provided, redirects to rankings endpoint.
   * @security BearerAuth
   * @param {string} search.query - Search query for athlete name
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {UserSearchResponse} 200 - Search results
   * @return {object} 308 - Redirect to rankings (if no search query)
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - No results found
   * @return {ErrorResponse} 400 - Validation error - Invalid query parameters
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users?search=haack",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"name": "John Haack", "username": "johnhaack"}]
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/users?search=haack",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 404 - No results found
   * {
   *   "status": "fail",
   *   "request_url": "/api/users?search=zzzznotfound",
   *   "message": "The resource cannot be found!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/users?search=haack",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/users",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getUsersValidation }),
    async (req: Request<GetUsersType, {}, {}>, res: Response) => {
      if (req.query.search) {
        const searched = await userService.searchUser(req.query);

        if (!searched?.data) throw new NotFoundError("The resource cannot be found!");

        context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

        res.status(200).json({
          status: "success",
          request_url: req.originalUrl,
          message: "The resource was returned successfully!",
          data: searched?.data || [],
          pagination: searched?.pagination,
        });

        return;
      }

      res.status(308).redirect("/api/rankings");
    },
  );

  /**
   * Progression point
   * @typedef {object} ProgressionPoint
   * @property {string} date - Meet date (YYYY-MM-DD)
   * @property {string} meet - Meet name
   * @property {string} federation - Federation
   * @property {string} equipment - Equipment used
   * @property {string} weight_class - Weight class
   * @property {string} bodyweight - Body weight
   * @property {string} squat - Best squat at that meet
   * @property {string} bench - Best bench at that meet
   * @property {string} deadlift - Best deadlift at that meet
   * @property {string} total - Meet total
   * @property {string} dots - DOTS score at that meet
   * @property {string} place - Placement
   */

  /**
   * Progression response
   * @typedef {object} ProgressionResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {ProgressionPoint[]} data - Chronological list of meet performances
   */

  /**
   * GET /api/users/{username}/progression
   * @tags Users
   * @summary Get an athlete's competition progression over time
   * @description Returns a chronological time-series of total/squat/bench/deadlift/DOTS for every meet in the lifter's history. Useful for charting strength progression.
   * @security BearerAuth
   * @param {string} username.path.required - Athlete's username/slug
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {ProgressionResponse} 200 - Progression data
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Athlete not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack/progression",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"date": "2018-04-21", "meet": "USAPL Raw Nationals", "total": "2007", "dots": "560.5"}]
   * }
   */
  router.get(
    "/api/users/:username/progression",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getUserValidation,
      query: userUnitsQueryValidation,
    }),
    async (req: Request<GetUserType, {}, {}, UserUnitsQueryType>, res: Response) => {
      const units = req.query.units ?? "lbs";
      const progression = await userService.getProgression(req.params, units);

      if (!progression) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: progression,
      });
    },
  );

  /**
   * Personal best entry
   * @typedef {object} PersonalBestEntry
   * @property {string} value - Best lift value
   * @property {string} meet - Meet where this PB was set
   * @property {string} date - Date of the meet
   * @property {string} federation - Federation
   */

  /**
   * Personal bests by equipment
   * @typedef {object} PersonalBestsByEquipment
   * @property {string} equipment - Equipment type (Raw, Wraps, etc.)
   * @property {PersonalBestEntry} squat - Best squat
   * @property {PersonalBestEntry} bench - Best bench
   * @property {PersonalBestEntry} deadlift - Best deadlift
   * @property {PersonalBestEntry} total - Best total
   * @property {PersonalBestEntry} dots - Best DOTS
   */

  /**
   * Personal bests response
   * @typedef {object} PersonalBestsResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {PersonalBestsByEquipment[]} data - PBs grouped by equipment
   */

  /**
   * GET /api/users/{username}/personal-bests
   * @tags Users
   * @summary Get an athlete's personal bests grouped by equipment
   * @description Returns the lifter's all-time best squat, bench, deadlift, total, and DOTS for each equipment type, with the meet and date where each PB was set.
   * @security BearerAuth
   * @param {string} username.path.required - Athlete's username/slug
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {PersonalBestsResponse} 200 - Personal bests
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Athlete not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   */
  router.get(
    "/api/users/:username/personal-bests",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getUserValidation,
      query: userUnitsQueryValidation,
    }),
    async (req: Request<GetUserType, {}, {}, UserUnitsQueryType>, res: Response) => {
      const units = req.query.units ?? "lbs";
      const personalBests = await userService.getPersonalBests(req.params, units);

      if (!personalBests) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: personalBests,
      });
    },
  );

  /**
   * User rank response
   * @typedef {object} UserRankResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {object} data - Rank info with global_rank, best_dots, best_total, sex, equipment, weight_class
   */

  /**
   * GET /api/users/{username}/rank
   * @tags Users
   * @summary Get an athlete's global ranking
   * @description Returns the lifter's current position in the global DOTS-sorted rankings along with their best total, best DOTS, sex, equipment, and weight class.
   * @security BearerAuth
   * @param {string} username.path.required - Athlete's username/slug
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {UserRankResponse} 200 - Rank info
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Athlete not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   */
  router.get(
    "/api/users/:username/rank",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getUserValidation,
      query: userUnitsQueryValidation,
    }),
    async (req: Request<GetUserType, {}, {}, UserUnitsQueryType>, res: Response) => {
      const units = req.query.units ?? "lbs";
      const rank = await userService.getRank(req.params, units);

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

  /**
   * Comparison summary
   * @typedef {object} UserComparisonSummary
   * @property {string} name - Lifter name
   * @property {string} username - Username/slug
   * @property {string} sex - M or F
   * @property {number} total_meets - Number of meets in career
   * @property {string} best_total - All-time best total
   * @property {string} best_dots - All-time best DOTS
   * @property {string} best_squat - All-time best squat
   * @property {string} best_bench - All-time best bench
   * @property {string} best_deadlift - All-time best deadlift
   * @property {string} first_meet_date - Date of first meet
   * @property {string} last_meet_date - Date of most recent meet
   */

  /**
   * Shared meet entry
   * @typedef {object} SharedMeetEntry
   * @property {string} date - Meet date
   * @property {string} meet - Meet name
   * @property {string} federation - Federation
   * @property {string} a_total - A's total
   * @property {string} a_dots - A's DOTS
   * @property {string} a_place - A's placement
   * @property {string} b_total - B's total
   * @property {string} b_dots - B's DOTS
   * @property {string} b_place - B's placement
   */

  /**
   * Compare response
   * @typedef {object} CompareResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {object} data - Comparison object with `a`, `b`, and `shared_meets`
   */

  /**
   * GET /api/users/compare
   * @tags Users
   * @summary Compare two athletes side-by-side
   * @description Returns career summary stats for two lifters and any meets where both competed.
   * @security BearerAuth
   * @param {string} a.query.required - First athlete's username
   * @param {string} b.query.required - Second athlete's username
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {CompareResponse} 200 - Comparison data
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - One or both athletes not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   */
  router.get(
    "/api/users/compare",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getCompareValidation }),
    async (req: Request<{}, {}, {}, GetCompareType>, res: Response) => {
      const units = req.query.units ?? "lbs";
      const comparison = await userService.compareUsers({ a: req.query.a, b: req.query.b }, units);

      if (!comparison) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: comparison,
      });
    },
  );

  /**
   * GET /api/users/{username}
   * @tags Users
   * @summary Get athlete profile by username
   * @description Returns detailed athlete profile including personal bests and competition history
   * @security BearerAuth
   * @param {string} username.path.required - Athlete's username/slug
   * @param {string} include_attempts.query - Include individual attempt data (true or false, default false) - enum:true,false
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {UserResponse} 200 - Athlete profile
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Athlete not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack",
   *   "message": "The resource was returned successfully!",
   *   "data": {"name": "John Haack", "personal_best": []}
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/users/johnhaack",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 404 - Athlete not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/users/nonexistentuser",
   *   "message": "The resource cannot be found!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/users/johnhaack",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  router.get(
    "/api/users/:username",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getUserValidation,
      query: getUserQueryValidation,
    }),
    async (req: Request<GetUserType, {}, {}, GetUserQueryType>, res: Response) => {
      const includeAttempts = req.query.include_attempts === "true";
      const units = req.query.units ?? "lbs";
      const user = await userService.getUser(req.params, includeAttempts, units);

      if (!user) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: user,
      });
    },
  );

  return router;
}
