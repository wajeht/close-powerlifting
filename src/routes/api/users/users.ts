import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { Logger } from "../../../utils/logger";
import { Middleware } from "../../middleware";
import { UsersService } from "./users.service";
import {
  getUserValidation,
  getUsersValidation,
  GetUserType,
  GetUsersType,
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
 * @property {object[]} data - Empty array
 */

export function UsersRouter() {
  const middleware = Middleware();
  const logger = Logger();
  const usersService = UsersService();

  const router = express.Router();

  /**
   * GET /api/users
   * @tags Users
   * @summary Search for athletes or redirect to rankings
   * @description Searches for athletes by name. If no search query is provided, redirects to rankings endpoint.
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} search.query - Search query for athlete name
   * @param {number} current_page.query - Page number (default 1)
   * @param {number} per_page.query - Results per page (max 500, default 100)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {UserSearchResponse} 200 - Search results
   * @return {object} 308 - Redirect to rankings (if no search query)
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - No results found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users?search=haack",
   *   "message": "The resource was returned successfully!",
   *   "data": [{"name": "John Haack", "username": "johnhaack"}]
   * }
   */
  router.get(
    "/",
    middleware.apiValidationMiddleware({ query: getUsersValidation }),
    async (req: Request<GetUsersType, {}, {}>, res: Response) => {
      if (req.query.search) {
        const searched = await usersService.searchUser(req.query);

        if (!searched?.data) throw new NotFoundError("The resource cannot be found!");

        logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
   * GET /api/users/{username}
   * @tags Users
   * @summary Get athlete profile by username
   * @description Returns detailed athlete profile including personal bests and competition history
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} username.path.required - Athlete's username/slug
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {UserResponse} 200 - Athlete profile
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Athlete not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/users/johnhaack",
   *   "message": "The resource was returned successfully!",
   *   "data": {"name": "John Haack", "personal_best": []}
   * }
   */
  router.get(
    "/:username",
    middleware.apiValidationMiddleware({ params: getUserValidation }),
    async (req: Request<GetUserType, {}, {}>, res: Response) => {
      const user = await usersService.getUser(req.params);

      if (!user) throw new NotFoundError("The resource cannot be found!");

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
