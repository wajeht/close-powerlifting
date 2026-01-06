import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createMeetService } from "./meets.service";
import {
  getMeetParamValidation,
  getMeetQueryValidation,
  GetMeetParamType,
  GetMeetQueryType,
} from "./meets.validation";

/**
 * Meet result entry
 * @typedef {object} MeetResult
 * @property {string} place - Placement in meet
 * @property {string} name - Lifter name
 * @property {string} sex - M or F
 * @property {string} age - Age at competition
 * @property {string} equipment - Equipment type
 * @property {string} weight_class - Weight class
 * @property {string} bodyweight - Body weight
 * @property {string} squat - Squat result
 * @property {string} bench - Bench result
 * @property {string} deadlift - Deadlift result
 * @property {string} total - Total
 * @property {string} dots - DOTS score
 */

/**
 * Meet data
 * @typedef {object} MeetData
 * @property {string} title - Meet title
 * @property {string} date - Meet date (YYYY-MM-DD)
 * @property {string} location - Meet location
 * @property {MeetResult[]} results - Meet results
 */

/**
 * Meet response
 * @typedef {object} MeetResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {MeetData} data - Meet data
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} data - Empty array
 */

export function createMeetsRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
  );
  const meetService = createMeetService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/meets/{meet}
   * @tags Meets
   * @summary Get meet results by meet code
   * @description Returns detailed meet information including all lifter results with attempt data
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} meet.path.required - Meet code (e.g., usapl/CA-2024-01, rps/2548, uspa/1969)
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {MeetResponse} 200 - Meet data with results
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Meet not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/meets/uspa/1969",
   *   "message": "The resource was returned successfully!",
   *   "data": {"title": "2024 USPA Nationals", "results": []}
   * }
   */
  router.get(
    "/*meet",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiValidationMiddleware({
      params: getMeetParamValidation,
      query: getMeetQueryValidation,
    }),
    async (req: Request<GetMeetParamType, {}, GetMeetQueryType>, res: Response) => {
      const result = await meetService.getMeet(req.params);

      if (!result.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: result.data,
      });
    },
  );

  return router;
}
