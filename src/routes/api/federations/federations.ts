import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as FederationsService from "./federations.service";
import {
  getFederationsValidation,
  getFederationsParamValidation,
  getFederationsQueryValidation,
  GetFederationsType,
  GetFederationsParamType,
  GetFederationsQueryType,
} from "./federations.validation";

const router = express.Router();

/**
 * GET /api/federations
 * @tags federations
 * @summary get all federations with optional pagination
 * @security BearerAuth
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getFederationsValidation }),
  catchAsyncHandler(async (req: Request<{}, {}, GetFederationsType>, res: Response) => {
    const federations = await FederationsService.getFederations(req.query);

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: federations?.cache,
      data: federations?.data,
      pagination: federations?.pagination,
    });
  }),
);

/**
 * GET /api/federations/:federation
 * @tags federations
 * @summary get specific federation details
 * @security BearerAuth
 */
router.get(
  "/:federation",
  apiValidationMiddleware({
    params: getFederationsParamValidation,
    query: getFederationsQueryValidation,
  }),
  catchAsyncHandler(
    async (req: Request<GetFederationsParamType, {}, GetFederationsQueryType>, res: Response) => {
      const federations = await FederationsService.getFederation({ ...req.params, ...req.query });

      if (!federations) throw new NotFoundError("The resource cannot be found!");

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(StatusCodes.OK).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        cache: federations?.cache,
        data: federations?.data,
      });
    },
  ),
);

export default router;
