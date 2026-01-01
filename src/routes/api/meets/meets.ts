import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as MeetsService from "./meets.service";
import {
  getMeetParamValidation,
  getMeetQueryValidation,
  GetMeetParamType,
  GetMeetQueryType,
} from "./meets.validation";

const router = express.Router();

/**
 * GET /api/meets/{meet}
 * @tags meets
 * @summary get specific meet details including title, date, location, and results
 * @security BearerAuth
 * @param {string} meet.path.required - the meet code (e.g., usapl/ISR-2025-02 or rps/2548)
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response with meet metadata and results
 * @return {object} 404 - not found
 */
router.get(
  "/:meet",
  apiValidationMiddleware({
    params: getMeetParamValidation,
    query: getMeetQueryValidation,
  }),
  async (req: Request<GetMeetParamType, {}, GetMeetQueryType>, res: Response) => {
    const result = await MeetsService.getMeet({ ...req.params, ...req.query });

    if (!result.data) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: result.cache,
      data: result.data,
    });
  },
);

export default router;
