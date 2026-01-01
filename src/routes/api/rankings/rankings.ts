import express, { Request, Response } from "express";
import catchAsyncHandler from "express-async-handler";
import { StatusCodes } from "http-status-codes";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as RankingsService from "./rankings.service";
import {
  getRankingsValidation,
  getRankValidation,
  GetRankingsType,
  GetRankType,
} from "./rankings.validation";

const router = express.Router();

/**
 * GET /api/rankings
 * @tags rankings
 * @summary get all rankings with optional pagination
 * @security BearerAuth
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getRankingsValidation }),
  catchAsyncHandler(async (req: Request<{}, {}, GetRankingsType>, res: Response) => {
    const rankings = await RankingsService.getRankings(req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: rankings?.cache,
      data: rankings?.data,
      pagination: rankings?.pagination,
    });
  }),
);

/**
 * GET /api/rankings/:rank
 * @tags rankings
 * @summary get specific rank details
 * @security BearerAuth
 */
router.get(
  "/:rank",
  apiValidationMiddleware({ params: getRankValidation }),
  catchAsyncHandler(async (req: Request<GetRankType, {}, {}>, res: Response) => {
    const rank = await RankingsService.getRank(req.params);

    if (!rank) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: rank,
    });
  }),
);

export default router;
