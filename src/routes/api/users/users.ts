import express, { Request, Response } from "express";
import catchAsyncHandler from "express-async-handler";
import { StatusCodes } from "http-status-codes";

import { NotFoundError } from "../../../error";
import logger from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import * as UsersService from "./users.service";
import {
  getUserValidation,
  getUsersValidation,
  GetUserType,
  GetUsersType,
} from "./users.validation";

const router = express.Router();

/**
 * GET /api/users
 * @tags users
 * @summary search users or redirect to rankings
 * @security BearerAuth
 */
router.get(
  "/",
  apiValidationMiddleware({ query: getUsersValidation }),
  catchAsyncHandler(async (req: Request<GetUsersType, {}, {}>, res: Response) => {
    if (req.query.search) {
      const searched = await UsersService.searchUser(req.query);

      if (!searched) throw new NotFoundError("The resource cannot be found!");

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(StatusCodes.OK).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: searched?.data || [],
      });

      return;
    }

    res.status(StatusCodes.PERMANENT_REDIRECT).redirect("/api/rankings");
  }),
);

/**
 * GET /api/users/:username
 * @tags users
 * @summary get specific user details
 * @security BearerAuth
 */
router.get(
  "/:username",
  apiValidationMiddleware({ params: getUserValidation }),
  catchAsyncHandler(async (req: Request<GetUserType, {}, {}>, res: Response) => {
    const user = await UsersService.getUser(req.params);

    if (!user) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: user,
    });
  }),
);

export default router;
