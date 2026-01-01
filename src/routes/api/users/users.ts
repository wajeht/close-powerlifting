import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getUser, searchUser } from "./users.service";
import {
  getUserValidation,
  getUsersValidation,
  GetUserType,
  GetUsersType,
} from "./users.validation";

const usersRouter = express.Router();

/**
 * User search result
 * @typedef {object} UserSearchResult
 * @property {string} name - Athlete name
 * @property {string} url - Profile URL path
 */

/**
 * User profile
 * @typedef {object} UserProfile
 * @property {string} name - Athlete name
 * @property {string} sex - M or F
 * @property {string} country - Country code
 * @property {string} state - State/province (if applicable)
 * @property {array<object>} competition_history - List of competition results
 */

/**
 * User search response
 * @typedef {object} UserSearchResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {array<UserSearchResult>} data - Array of matching users
 */

/**
 * User profile response
 * @typedef {object} UserProfileResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {UserProfile} data - User profile data
 */

/**
 * GET /api/users
 * @tags Users
 * @summary Search users by name
 * @description Search for athletes by name. Returns matching users with their profile URLs. If no search parameter is provided, redirects to /api/rankings.
 * @security BearerAuth
 * @param {string} search.query - Search term for user lookup (e.g., "haack", "john")
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {number} current_page.query - Page number (default 1)
 * @return {UserSearchResponse} 200 - Success response with matching users
 * @return {object} 308 - Redirect to /api/rankings if no search term provided
 * @return {object} 404 - No users found
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/users?search=haack",
 *   "message": "The resource was returned successfully!",
 *   "data": [{"name": "John Haack", "url": "/api/users/johnhaack"}]
 * }
 */
usersRouter.get(
  "/",
  apiValidationMiddleware({ query: getUsersValidation }),
  async (req: Request<GetUsersType, {}, {}>, res: Response) => {
    if (req.query.search) {
      const searched = await searchUser(req.query);

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
 * @summary Get user profile by username
 * @description Returns detailed profile for a specific athlete including personal info and full competition history
 * @security BearerAuth
 * @param {string} username.path.required - Username/athlete name slug (e.g., johnhaack,aborisov)
 * @return {UserProfileResponse} 200 - Success response with user profile
 * @return {object} 404 - User not found
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/users/johnhaack",
 *   "message": "The resource was returned successfully!",
 *   "data": {
 *     "name": "John Haack",
 *     "sex": "M",
 *     "country": "USA",
 *     "competition_history": [{"meet": "2024 USPA Nationals", "total_kg": 900}]
 *   }
 * }
 */
usersRouter.get(
  "/:username",
  apiValidationMiddleware({ params: getUserValidation }),
  async (req: Request<GetUserType, {}, {}>, res: Response) => {
    const user = await getUser(req.params);

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

export { usersRouter };
