import express, { Request, Response } from "express";
import catchAsyncHandler from "express-async-handler";
import { StatusCodes } from "http-status-codes";

import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as StatusService from "./status.service";
import { getStatusValidation, GetStatusType } from "./status.validation";

const router = express.Router();

/**
 * GET /api/status
 * @tags status
 * @summary get openpowerlifting status
 * @security BearerAuth
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getStatusValidation }),
  catchAsyncHandler(async (req: Request<{}, {}, GetStatusType>, res: Response) => {
    const status = await StatusService.getStatus(req.query);

    logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: status.cache,
      data: status.data,
    });
  }),
);

export default router;
