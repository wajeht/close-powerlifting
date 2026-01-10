import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMiddleware } from "../../middleware";
import { createRecordService } from "./records.service";
import {
  getRecordsValidation,
  getFilteredRecordsParamValidation,
  getFilteredRecordsQueryValidation,
  type GetRecordsType,
  type GetFilteredRecordsParamType,
  type GetFilteredRecordsQueryType,
} from "./records.validation";

/**
 * Record entry representing a single powerlifting record
 * @typedef {object} RecordEntry
 * @property {string} weightclass - Weight class (e.g., "90", "100+")
 * @property {string} lifter - Record holder name
 * @property {string} lift - Lift amount in lbs/kg
 * @property {string} date - Date record was set (YYYY-MM-DD)
 * @property {string} federation - Federation where record was set
 */

/**
 * Record category grouping records by lift type
 * @typedef {object} RecordCategory
 * @property {string} title - Category title (e.g., "Men's Raw Squat", "Women's Unlimited Bench")
 * @property {RecordEntry[]} records - Array of records in this category
 */

/**
 * Successful records response
 * @typedef {object} RecordsResponse
 * @property {string} status - Response status ("success")
 * @property {string} request_url - Original request URL
 * @property {string} message - Success message
 * @property {RecordCategory[]} data - Array of record categories
 */

/**
 * Error response for failed requests
 * @typedef {object} RecordsErrorResponse
 * @property {string} status - Response status ("fail")
 * @property {string} request_url - Original request URL
 * @property {string} message - Error message describing the failure
 * @property {object[]} errors - Validation errors (for 400 responses)
 */

export function createRecordsRouter(context: AppContext) {
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
  const recordService = createRecordService(context.scraper);

  const router = express.Router();

  /**
   * GET /api/records
   * @tags Records
   * @summary Get all powerlifting records
   * @description Returns all-time powerlifting world records organized by category (lift type and sex). Records are grouped into categories like "Men's Raw Squat", "Women's Unlimited Deadlift", etc.
   * @security BearerAuth
   * @return {RecordsResponse} 200 - All records organized by category
   * @return {RecordsErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {RecordsErrorResponse} 404 - Records not found
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "title": "Men's Raw Squat",
   *       "records": [
   *         {"weightclass": "90", "lifter": "John Haack", "lift": "782", "date": "2023-10-15", "federation": "USPA"}
   *       ]
   *     }
   *   ]
   * }
   */
  router.get(
    "/",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    middleware.apiValidationMiddleware({ query: getRecordsValidation }),
    async (req: Request<{}, {}, GetRecordsType>, res: Response) => {
      const records = await recordService.getRecords({});

      if (!records?.data) throw new NotFoundError("The resource cannot be found!");

      context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: records?.data,
      });
    },
  );

  /**
   * GET /api/records/{equipment}
   * @tags Records
   * @summary Get records filtered by equipment type
   * @description Returns powerlifting records filtered by equipment category. Equipment types correspond to different levels of supportive gear allowed in competition.
   * @security BearerAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single,multi,unlimited,all-tested
   * @return {RecordsResponse} 200 - Records filtered by equipment
   * @return {RecordsErrorResponse} 400 - Invalid equipment parameter
   * @return {RecordsErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {RecordsErrorResponse} 404 - Records not found
   * @example response - 200 - Success response for raw records
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "title": "Men's Raw Squat",
   *       "records": [
   *         {"weightclass": "90", "lifter": "John Haack", "lift": "782", "date": "2023-10-15", "federation": "USPA"}
   *       ]
   *     }
   *   ]
   * }
   */
  router.get(
    "/:equipment",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
        data: records?.data,
      });
    },
  );

  /**
   * GET /api/records/{equipment}/{sex_or_weight_class}
   * @tags Records
   * @summary Get records filtered by equipment and sex or weight class
   * @description Returns records filtered by equipment and either sex (men/women) or weight class system. Weight class systems include: expanded-classes (more weight divisions), ipf-classes (IPF standard), para-classes (Paralympic), wp-classes (World Powerlifting).
   * @security BearerAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single,multi,unlimited,all-tested
   * @param {string} sex_or_weight_class.path.required - Either sex (men, women) or weight class system (expanded-classes, ipf-classes, para-classes, wp-classes)
   * @return {RecordsResponse} 200 - Records filtered by equipment and sex/weight class
   * @return {RecordsErrorResponse} 400 - Invalid equipment parameter
   * @return {RecordsErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {RecordsErrorResponse} 404 - Invalid sex or weight class parameter
   * @example response - 200 - Success response filtered by sex
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw/men",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "title": "Men's Raw Squat",
   *       "records": [
   *         {"weightclass": "90", "lifter": "John Haack", "lift": "782", "date": "2023-10-15", "federation": "USPA"}
   *       ]
   *     }
   *   ]
   * }
   * @example response - 200 - Success response filtered by weight class system
   * {
   *   "status": "success",
   *   "request_url": "/api/records/unlimited/wp-classes",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "title": "Men's Unlimited Squat",
   *       "records": [
   *         {"weightclass": "120+", "lifter": "Blaine Sumner", "lift": "1102", "date": "2023-03-04", "federation": "WP"}
   *       ]
   *     }
   *   ]
   * }
   */
  router.get(
    "/:equipment/:sex_or_weight_class",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
    async (
      req: Request<
        { equipment: string; sex_or_weight_class: string },
        {},
        {},
        GetFilteredRecordsQueryType
      >,
      res: Response,
      next,
    ) => {
      try {
        const { equipment, sex_or_weight_class } = req.params;
        const filters = recordService.parseSexOrWeightClass(equipment, sex_or_weight_class);
        const records = await recordService.getFilteredRecords(filters, req.query);

        if (!records?.data) throw new NotFoundError("The resource cannot be found!");

        context.logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

        res.status(200).json({
          status: "success",
          request_url: req.originalUrl,
          message: "The resource was returned successfully!",
          data: records?.data,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/records/{equipment}/{weight_class}/{sex}
   * @tags Records
   * @summary Get records filtered by equipment, weight class system, and sex
   * @description Returns records filtered by all three criteria: equipment category, weight class system, and sex. This is the most specific filtering option available.
   * @security BearerAuth
   * @param {string} equipment.path.required - Equipment type - enum:raw,wraps,single,multi,unlimited,all-tested
   * @param {string} weight_class.path.required - Weight class system - enum:expanded-classes,ipf-classes,para-classes,wp-classes
   * @param {string} sex.path.required - Sex - enum:men,women
   * @return {RecordsResponse} 200 - Records filtered by all criteria
   * @return {RecordsErrorResponse} 400 - Invalid equipment, weight class, or sex parameter
   * @return {RecordsErrorResponse} 401 - Unauthorized - Invalid or missing API key
   * @return {RecordsErrorResponse} 404 - Records not found
   * @example response - 200 - Success response for women's unlimited WP-class records
   * {
   *   "status": "success",
   *   "request_url": "/api/records/unlimited/wp-classes/women",
   *   "message": "The resource was returned successfully!",
   *   "data": [
   *     {
   *       "title": "Women's Unlimited Squat",
   *       "records": [
   *         {"weightclass": "84+", "lifter": "April Mathis", "lift": "854", "date": "2022-11-12", "federation": "WP"}
   *       ]
   *     }
   *   ]
   * }
   */
  router.get(
    "/:equipment/:weight_class/:sex",
    middleware.rateLimitMiddleware,
    middleware.apiAuthenticationMiddleware,
    middleware.trackAPICallsMiddleware,
    middleware.apiCacheControlMiddleware,
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
        data: records?.data,
      });
    },
  );

  return router;
}
