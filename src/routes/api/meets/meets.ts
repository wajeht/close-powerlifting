import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createMeetService } from "./meets.service";
import {
  getMeetParamValidation,
  getMeetQueryValidation,
  getMeetHighlightsParamValidation,
  getMeetHighlightsQueryValidation,
  GetMeetParamType,
  GetMeetQueryType,
  GetMeetHighlightsQueryType,
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
 * @property {object[]} errors - Error details array
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
    context.apiCallLogRepository,
  );
  const meetService = createMeetService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/meets/{meet}
   * @tags Meets
   * @summary Get meet results by meet code
   * @description Returns detailed meet information including all lifter results with attempt data
   * @security BearerAuth
   * @param {string} meet.path.required - Meet code (e.g., usapl/CA-2024-01, rps/2548, uspa/1969)
   * @param {string} sort.query - Sort order for results - enum:by-dots,by-wilks,by-wilks2020,by-glossbrenner,by-goodlift,by-ipf-points,by-mcculloch,by-total,by-ah,by-nasa,by-reshel,by-schwartz-malone,by-division
   * @param {string} units.query - Unit system for weight values (lbs or kg, default: lbs) - enum:lbs,kg
   * @return {MeetResponse} 200 - Meet data with results
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Meet not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/meets/uspa/1969",
   *   "message": "The resource was returned successfully!",
   *   "data": {"title": "2024 USPA Nationals", "results": []}
   * }
   * @example response - 401 - Unauthorized
   * {
   *   "status": "fail",
   *   "request_url": "/api/meets/uspa/1969",
   *   "message": "Authorization header required!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 404 - Meet not found
   * {
   *   "status": "fail",
   *   "request_url": "/api/meets/invalid/code",
   *   "message": "The resource cannot be found!",
   *   "errors": [],
   *   "data": []
   * }
   * @example response - 429 - Rate limit exceeded
   * {
   *   "status": "fail",
   *   "request_url": "/api/meets/uspa/1969",
   *   "message": "Too many requests, please try again later?",
   *   "errors": [],
   *   "data": []
   * }
   */
  /**
   * Meet highlight lifter
   * @typedef {object} MeetHighlightLifter
   * @property {string} place - Placement
   * @property {string} name - Lifter name
   * @property {string} sex - M or F
   * @property {string} weight_class - Weight class
   * @property {string} bodyweight - Body weight
   * @property {string} squat - Best squat
   * @property {string} bench - Best bench
   * @property {string} deadlift - Best deadlift
   * @property {string} total - Total
   * @property {string} dots - DOTS score
   */

  /**
   * Meet highlights data
   * @typedef {object} MeetHighlightsData
   * @property {string} title - Meet title
   * @property {string} date - Meet date
   * @property {string} location - Meet location
   * @property {number} total_lifters - Total lifters
   * @property {string[]} weight_classes_contested - Distinct weight classes
   * @property {MeetHighlightLifter[]} top_by_dots - Top 3 by DOTS
   * @property {MeetHighlightLifter[]} top_by_total - Top 3 by total
   */

  /**
   * Meet highlights response
   * @typedef {object} MeetHighlightsResponse
   * @property {string} status - Response status
   * @property {string} request_url - Request URL
   * @property {string} message - Response message
   * @property {MeetHighlightsData} data - Highlights data
   */

  /**
   * GET /api/meets/{federation}/{code}/highlights
   * @tags Meets
   * @summary Get meet highlights
   * @description Returns a summary of a meet: total lifters, weight classes contested, and top 3 lifters by DOTS and by total.
   * @security BearerAuth
   * @param {string} federation.path.required - Federation slug (e.g., uspa, usapl)
   * @param {string} code.path.required - Meet code (e.g., 1969, ISR-2025-02)
   * @param {string} units.query - Unit system (lbs or kg, default lbs) - enum:lbs,kg
   * @return {MeetHighlightsResponse} 200 - Highlights data
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Meet not found
   * @return {ErrorResponse} 429 - Rate limit exceeded
   */
  router.get(
    "/api/meets/:federation/:code/highlights",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      query: getMeetHighlightsQueryValidation,
    }),
    async (
      req: Request<{ federation: string; code: string }, {}, {}, GetMeetHighlightsQueryType>,
      res: Response,
    ) => {
      const meetPath = `${req.params.federation}/${req.params.code}`;
      const parsed = getMeetHighlightsParamValidation.safeParse({ meet: meetPath });
      if (!parsed.success) throw new NotFoundError("The resource cannot be found!");

      const result = await meetService.getMeetHighlights(parsed.data, req.query.units);

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

  router.get(
    "/api/meets/*meet",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({
      params: getMeetParamValidation,
      query: getMeetQueryValidation,
    }),
    async (req: Request<GetMeetParamType, {}, {}, GetMeetQueryType>, res: Response) => {
      const result = await meetService.getMeet(req.params, req.query.sort, req.query.units);

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
