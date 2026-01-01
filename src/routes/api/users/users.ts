import express, { Request, Response } from "express";

import { NotFoundError } from "../../../error";
import { logger } from "../../../utils/logger";
import { apiValidationMiddleware } from "../../middleware";
import { getUser, searchUser } from "./users.service";
import {
  getUserValidation,
  getUsersValidation,
  GetUserType,
  GetUsersType,
} from "./users.validation";

const usersRouter = express.Router();

/**
 * GET /api/users
 * @tags users
 * @summary search users or redirect to rankings
 * @security BearerAuth
 * @param {string} search.query - search term for user lookup
 * @return {object} 200 - success response
 * @return {object} 308 - redirect to rankings
 * @return {object} 404 - not found
 */
usersRouter.get(
  "/",
  apiValidationMiddleware({ query: getUsersValidation }),
  async (req: Request<GetUsersType, {}, {}>, res: Response) => {
    if (req.query.search) {
      const searched = await searchUser(req.query);

      if (!searched?.data) throw new NotFoundError("The resource cannot be found!");

      logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "The resource was returned successfully!",
        data: searched?.data || [],
      });

      return;
    }

    res.status(308).redirect("/api/rankings");
  },
);

/**
 * GET /api/users/{username}
 * @tags users
 * @summary get specific user details
 * @security BearerAuth
 * @param {string} username.path.required - the username to look up
 * @return {object} 200 - success response
 * @return {object} 404 - not found
 */
usersRouter.get(
  "/:username",
  apiValidationMiddleware({ params: getUserValidation }),
  async (req: Request<GetUserType, {}, {}>, res: Response) => {
    const user = await getUser(req.params);

    if (!user) throw new NotFoundError("The resource cannot be found!");

    logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: user,
    });
  },
);

export { usersRouter };
