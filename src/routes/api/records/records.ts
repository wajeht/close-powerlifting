import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createRecordService } from "./records.service";
import {
  getRecordsValidation,
  getFilteredRecordsParamValidation,
  getFilteredRecordsQueryValidation,
  GetRecordsType,
  GetFilteredRecordsParamType,
  GetFilteredRecordsQueryType,
} from "./records.validation";

/**
 * Record entry
 * @typedef {object} RecordEntry
 * @property {string} lifter - Record holder name
 * @property {string} weight_class - Weight class
 * @property {string} lift - Lift amount
 * @property {string} date - Date of record
 * @property {string} meet - Meet where record was set
 */

/**
 * Record category
 * @typedef {object} RecordCategory
 * @property {string} title - Category title (e.g., "Men's Raw Squat")
 * @property {RecordEntry[]} records - Records in this category
 */

/**
 * Records response
 * @typedef {object} RecordsResponse
 * @property {string} status - Response status
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {boolean} cache - Whether data was cached
 * @property {RecordCategory[]} data - Record categories
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} data - Empty array
 */

export function createRecordsRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
  );
  const recordService = createRecordService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/records
   * @tags Records
   * @summary Get all powerlifting records
   * @description Returns all-time powerlifting records organized by category
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RecordsResponse} 200 - All records by category
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Records not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"title": "Men's Raw Squat", "records": []}]
   * }
   */
  router.get(
    "/",
    middleware.apiValidationMiddleware({ query: getRecordsValidation }),
    async (req: Request<{}, {}, GetRecordsType>, res: Response) => {
      const records = await recordService.getRecords(req.query);

      if (!records?.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
   * @summary Get records filtered by equipment
   * @description Returns records filtered by equipment category
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RecordsResponse} 200 - Filtered records
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Records not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"title": "Men's Raw Squat", "records": []}]
   * }
   */
  router.get(
    "/:equipment",
    middleware.apiValidationMiddleware({
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
      const records = await recordService.getFilteredRecords(req.params, req.query);

      if (!records?.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

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
   * @description Returns records filtered by equipment category and sex
   * @security BearerAuth
   * @security ApiKeyAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single-ply,multi-ply
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {boolean} cache.query - Use cached data (default true)
   * @return {RecordsResponse} 200 - Filtered records
   * @return {ErrorResponse} 401 - Unauthorized
   * @return {ErrorResponse} 404 - Records not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw/men",
   *   "message": "The resource was returned successfully!",
   *   "cache": true,
   *   "data": [{"title": "Men's Raw Squat", "records": []}]
   * }
   */
  router.get(
    "/:equipment/:sex",
    middleware.apiValidationMiddleware({
      params: getFilteredRecordsParamValidation,
      query: getFilteredRecordsQueryValidation,
    }),
    async (
      req: Request<GetFilteredRecordsParamType, {}, {}, GetFilteredRecordsQueryType>,
      res: Response,
    ) => {
      const records = await recordService.getFilteredRecords(req.params, req.query);

      if (!records?.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: records?.cache,
        data: records?.data,
      });
    },
  );

  return router;
}
