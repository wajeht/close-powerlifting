import express, { Request, Response } from "express";

import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getStatus } from "./status.service";
import { getStatusValidation, GetStatusType } from "./status.validation";

const statusRouter = express.Router();

/**
 * GET /api/status
 * @tags status
 * @summary get openpowerlifting status
 * @param {boolean} cache.query - use cached data (default: true)
 * @return {object} 200 - success response
 */
statusRouter.get(
  "/",
  apiValidationMiddleware({ query: getStatusValidation }),
  async (req: Request<{}, {}, GetStatusType>, res: Response) => {
    const status = await getStatus(req.query);

    logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      cache: status.cache,
      data: status.data,
    });
  },
);

export { statusRouter };
