import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as RecordsService from "./records.service";
import { getRecordsValidation, GetRecordsType } from "./records.validation";

const router = express.Router();

/**
 * GET /api/records
 * @tags records
 * @summary get all records
 * @security BearerAuth
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getRecordsValidation }),
  async (req: Request<{}, {}, GetRecordsType>, res: Response) => {
    const records = await RecordsService.getRecords(req.query);

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

export default router;
