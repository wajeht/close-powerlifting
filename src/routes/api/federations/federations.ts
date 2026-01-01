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
 * @param {number} current_page.query - page number (default: 1)
 * @param {number} per_page.query - items per page (default: 100)
 * @param {boolean} cache.query - use cached data (default: true)
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getFederationsValidation }),
  async (req: Request<{}, {}, GetFederationsType>, res: Response) => {
    const federations = await FederationsService.getFederations(req.query);

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
 * @tags federations
 * @summary get specific federation details
 * @security BearerAuth
 * @param {string} federation.path.required - the federation code (e.g., IPF, USAPL)
 * @param {number} year.query - filter by year
 * @param {boolean} cache.query - use cached data (default: true)
 */
router.get(
  "/:federation",
  apiValidationMiddleware({
    params: getFederationsParamValidation,
    query: getFederationsQueryValidation,
  }),
  async (req: Request<GetFederationsParamType, {}, GetFederationsQueryType>, res: Response) => {
    const federations = await FederationsService.getFederation({ ...req.params, ...req.query });

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

export default router;
