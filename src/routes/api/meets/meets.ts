import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getMeet } from "./meets.service";
import {
  getMeetParamValidation,
  getMeetQueryValidation,
  GetMeetParamType,
  GetMeetQueryType,
} from "./meets.validation";

const meetsRouter = express.Router();

/**
 * Meet metadata
 * @typedef {object} MeetMetadata
 * @property {string} title - Meet name/title
 * @property {string} date - Meet date
 * @property {string} federation - Federation code
 * @property {string} country - Country where meet was held
 * @property {string} state - State/province (if applicable)
 * @property {string} town - Town/city
 */

/**
 * Meet result entry
 * @typedef {object} MeetResultEntry
 * @property {string} name - Athlete name
 * @property {string} sex - M or F
 * @property {string} equipment - Equipment type
 * @property {number} bodyweight_kg - Bodyweight in kg
 * @property {string} weight_class_kg - Weight class
 * @property {number} squat1_kg - First squat attempt
 * @property {number} squat2_kg - Second squat attempt
 * @property {number} squat3_kg - Third squat attempt
 * @property {number} best_squat_kg - Best squat
 * @property {number} bench1_kg - First bench attempt
 * @property {number} bench2_kg - Second bench attempt
 * @property {number} bench3_kg - Third bench attempt
 * @property {number} best_bench_kg - Best bench
 * @property {number} deadlift1_kg - First deadlift attempt
 * @property {number} deadlift2_kg - Second deadlift attempt
 * @property {number} deadlift3_kg - Third deadlift attempt
 * @property {number} best_deadlift_kg - Best deadlift
 * @property {number} total_kg - Total lifted
 * @property {number} dots - DOTS score
 * @property {number} place - Placement in meet
 */

/**
 * Meet response
 * @typedef {object} MeetResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {object} data - Meet data
 * @property {MeetMetadata} data.metadata - Meet metadata
 * @property {array<MeetResultEntry>} data.results - Meet results
 */

/**
 * GET /api/meets/{meet}
 * @tags Meets
 * @summary Get specific meet details and results
 * @description Returns full meet information including metadata (title, date, location) and all competition results with individual attempts
 * @security BearerAuth
 * @param {string} meet.path.required - Meet identifier in format federation/meet-id (e.g., usapl/TX-2024-01, uspa/1969, rps/2548)
 * @param {boolean} cache.query - Use cached data - default: true
 * @return {MeetResponse} 200 - Success response with meet metadata and results
 * @return {object} 404 - Meet not found
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/meets/uspa/1969",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": {
 *     "metadata": {"title": "2024 USPA Nationals", "date": "2024-07-15", "federation": "USPA"},
 *     "results": [{"name": "John Haack", "total_kg": 900, "place": 1}]
 *   }
 * }
 */
meetsRouter.get(
  "/:meet",
  apiValidationMiddleware({
    params: getMeetParamValidation,
    query: getMeetQueryValidation,
  }),
  async (req: Request<GetMeetParamType, {}, GetMeetQueryType>, res: Response) => {
    const result = await getMeet({ ...req.params, ...req.query });

    if (!result.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: result.cache,
      data: result.data,
    });
  },
);

export { meetsRouter };
