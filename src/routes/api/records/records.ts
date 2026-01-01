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
 * GET /api/records
 * @tags records
 * @summary get all records
 * @security BearerAuth
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
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
 * @tags records
 * @summary get records filtered by equipment type
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
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
 * @tags records
 * @summary get records filtered by equipment and sex
 * @security BearerAuth
 * @param {string} equipment.path - equipment type: raw, wraps, raw-wraps, single-ply, multi-ply, unlimited
 * @param {string} sex.path - sex: men, women
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
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
