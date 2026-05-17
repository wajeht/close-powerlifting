import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { Units } from "../../../utils/helpers";
import { createUsersService } from "./users.service";
import {
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.validation";

export function createUsersRouter(context: AppContext) {
  const usersService = createUsersService(context.store);
  const router = express.Router();

  /**
   * GET /api/users
   * @tags Users
   * @summary Search for athletes or return the total lifter count
   */
  router.get("/api/users", (req: Request, res: Response) => {
    const query = getUsersValidation.parse(req.query);
    const { data, pagination } = usersService.searchOrSummary(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      ...(pagination ? { pagination } : {}),
    });
  });

  /**
   * GET /api/users/compare
   * @tags Users
   * @summary Compare two athletes side-by-side
   */
  router.get("/api/users/compare", (req: Request, res: Response) => {
    const query = getCompareValidation.parse(req.query);
    const result = usersService.compare(query);
    if (!result.found) {
      const missing = result.missing === "a" ? query.a : query.b;
      throw new NotFoundError(`Lifter "${missing}" not found`);
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result.data,
    });
  });

  /**
   * GET /api/users/{username}/progression
   * @tags Users
   * @summary Get competition progression over time
   */
  router.get("/api/users/:username/progression", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const data = usersService.getProgression(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}/personal-bests
   * @tags Users
   * @summary Get personal bests grouped by equipment
   */
  router.get("/api/users/:username/personal-bests", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const { units = "lbs" } = userUnitsQueryValidation.parse(req.query);
    const data = usersService.getPersonalBests(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}/rank
   * @tags Users
   * @summary Get an athlete's global ranking
   */
  router.get("/api/users/:username/rank", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const data = usersService.getRank(username);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/users/{username}
   * @tags Users
   * @summary Get athlete profile with competition history
   */
  router.get("/api/users/:username", (req: Request, res: Response) => {
    const { username } = getUserParamValidation.parse(req.params);
    const query = getUserQueryValidation.parse(req.query);
    const data = usersService.getUser(username, query);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  return router;
}
