import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getRecords, getFilteredRecords } from "./records.service";
import {
  getRecordsValidation,
  getFilteredRecordsParamValidation,
  getFilteredRecordsQueryValidation,
  GetRecordsType,
  GetFilteredRecordsParamType,
  GetFilteredRecordsQueryType,
} from "./records.validation";

const recordsRouter = express.Router();

/**
 * A record entry
 * @typedef {object} RecordEntry
 * @property {string} name - Athlete name
 * @property {string} sex - M or F
 * @property {string} equipment - Equipment type (Raw, Wraps, Single-ply, etc.)
 * @property {string} weight_class_kg - Weight class
 * @property {number} squat_kg - Squat record in kg
 * @property {number} bench_kg - Bench record in kg
 * @property {number} deadlift_kg - Deadlift record in kg
 * @property {number} total_kg - Total record in kg
 * @property {number} dots - DOTS score
 * @property {string} federation - Federation code
 * @property {string} date - Record date
 */

/**
 * Records response
 * @typedef {object} RecordsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {array<RecordEntry>} data - Array of record entries
 */

/**
 * GET /api/records
 * @tags Records
 * @summary Get all powerlifting records
 * @description Returns all-time powerlifting records across all equipment types and weight classes
 * @security BearerAuth
 * @param {boolean} cache.query - Use cached data - default: true
 * @return {RecordsResponse} 200 - Success response with all records
 * @example response - 200 - Success response
 * {
 *   "status": "success",
 *   "request_url": "/api/records",
 *   "message": "The resource was returned successfully!",
 *   "cache": true,
 *   "data": [{"name": "John Haack", "equipment": "Raw", "total_kg": 900}]
 * }
 */
recordsRouter.get(
  "/",
  apiValidationMiddleware({ query: getRecordsValidation }),
  async (req: Request<{}, {}, GetRecordsType>, res: Response) => {
    const records = await getRecords(req.query);

    if (!records?.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: records?.cache,
      data: records?.data,
    });
  },
);

/**
 * GET /api/records/{equipment}
 * @tags Records
 * @summary Get records filtered by equipment type
 * @description Returns powerlifting records for a specific equipment type
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {boolean} cache.query - Use cached data - default: true
 * @return {RecordsResponse} 200 - Success response with filtered records
 * @return {object} 404 - Records not found
 */
recordsRouter.get(
  "/:equipment",
  apiValidationMiddleware({
    params: getFilteredRecordsParamValidation.pick({ equipment: true }),
    query: getFilteredRecordsQueryValidation,
  }),
  async (
    req: Request<
      Pick<GetFilteredRecordsParamType, "equipment">,
      {},
      {},
      GetFilteredRecordsQueryType
    >,
    res: Response,
  ) => {
    const records = await getFilteredRecords(req.params, req.query);

    if (!records?.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: records?.cache,
      data: records?.data,
    });
  },
);

/**
 * GET /api/records/{equipment}/{sex}
 * @tags Records
 * @summary Get records filtered by equipment and sex
 * @description Returns powerlifting records for a specific equipment type and sex category
 * @security BearerAuth
 * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,raw-wraps,single-ply,multi-ply,unlimited
 * @param {string} sex.path.required - Sex category - enum:men,women
 * @param {boolean} cache.query - Use cached data - default: true
 * @return {RecordsResponse} 200 - Success response with filtered records
 * @return {object} 404 - Records not found
 */
recordsRouter.get(
  "/:equipment/:sex",
  apiValidationMiddleware({
    params: getFilteredRecordsParamValidation,
    query: getFilteredRecordsQueryValidation,
  }),
  async (
    req: Request<GetFilteredRecordsParamType, {}, {}, GetFilteredRecordsQueryType>,
    res: Response,
  ) => {
    const records = await getFilteredRecords(req.params, req.query);

    if (!records?.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: records?.cache,
      data: records?.data,
    });
  },
);

export { recordsRouter };
