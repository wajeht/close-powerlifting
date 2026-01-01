import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getFederations, getFederation } from "./federations.service";
import {
  getFederationsValidation,
  getFederationsParamValidation,
  getFederationsQueryValidation,
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

const federationsRouter = express.Router();

/**
 * A federation entry
 * @typedef {object} FederationEntry
 * @property {string} federation - Federation code (e.g., IPF, USAPL, USPA)
 * @property {string} name - Full federation name
 * @property {string} country - Country code
 * @property {number} lifter_count - Number of lifters in federation
 */

/**
 * Federation meet result
 * @typedef {object} FederationMeetResult
 * @property {string} name - Athlete name
 * @property {string} sex - M or F
 * @property {string} equipment - Equipment type
 * @property {number} bodyweight_kg - Bodyweight in kg
 * @property {string} weight_class_kg - Weight class
 * @property {number} squat_kg - Best squat in kg
 * @property {number} bench_kg - Best bench in kg
 * @property {number} deadlift_kg - Best deadlift in kg
 * @property {number} total_kg - Total in kg
 * @property {number} dots - DOTS score
 * @property {string} date - Competition date
 * @property {string} meet_name - Meet name
 */

/**
 * Federations list response
 * @typedef {object} FederationsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {array<FederationEntry>} data - Array of federation entries
 * @property {Pagination} pagination - Pagination info
 */

/**
 * GET /api/federations
 * @tags Federations
 * @summary Get all federations with optional pagination
 * @description Returns a paginated list of all powerlifting federations with their codes and lifter counts
 * @security BearerAuth
 * @param {number} current_page.query - Page number (default 1)
 * @param {number} per_page.query - Results per page (max 500, default 100)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {FederationsResponse} 200 - Success response with federations list
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/federations",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": [{"federation": "IPF", "name": "International Powerlifting Federation"}]
 * }
 */
federationsRouter.get(
  "/",
  apiValidationMiddleware({ query: getFederationsValidation }),
  async (req: Request<{}, {}, GetFederationsType>, res: Response) => {
    const federations = await getFederations(req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: federations?.cache,
      data: federations?.data,
      pagination: federations?.pagination,
    });
  },
);

/**
 * GET /api/federations/{federation}
 * @tags Federations
 * @summary Get results for a specific federation
 * @description Returns meet results for a specific federation, optionally filtered by year
 * @security BearerAuth
 * @param {string} federation.path.required - Federation code (e.g., ipf, usapl, uspa, wrpf)
 * @param {number} year.query - Filter results by competition year (e.g., 2024)
 * @param {boolean} cache.query - Use cached data (default true)
 * @return {object} 200 - Success response with federation results
 * @return {object} 404 - Federation not found
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/federations/ipf",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": [{"name": "John Haack", "total_kg": 900, "dots": 617.45}]
 * }
 */
federationsRouter.get(
  "/:federation",
  apiValidationMiddleware({
    params: getFederationsParamValidation,
    query: getFederationsQueryValidation,
  }),
  async (req: Request<GetFederationsParamType, {}, GetFederationsQueryType>, res: Response) => {
    const federations = await getFederation({ ...req.params, ...req.query });

    if (!federations?.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: federations?.cache,
      data: federations?.data,
    });
  },
);

export { federationsRouter };
