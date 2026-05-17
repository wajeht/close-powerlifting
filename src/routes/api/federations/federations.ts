import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createFederationsService } from "./federations.service";
import {
  getFederationMeetsQueryValidation,
  getFederationsParamValidation,
  getFederationsValidation,
} from "./federations.validation";

export function createFederationsRouter(context: AppContext) {
  const federationsService = createFederationsService(context.store);
  const router = express.Router();

  /**
   * GET /api/federations
   * @tags Federations
   * @summary Get all federations with optional pagination
   */
  router.get("/api/federations", (req: Request, res: Response) => {
    const query = getFederationsValidation.parse(req.query);
    const { data, pagination } = federationsService.getFederations(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/federations/{federation}/stats
   * @tags Federations
   * @summary Get a federation's meet count by year
   */
  router.get("/api/federations/:federation/stats", (req: Request, res: Response) => {
    const { federation } = getFederationsParamValidation.parse(req.params);
    const stats = federationsService.getFederationStats(federation);
    if (stats == null) throw new NotFoundError(`Federation "${federation}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: stats,
    });
  });

  /**
   * GET /api/federations/{federation}
   * @tags Federations
   * @summary Get meets for a specific federation
   */
  router.get("/api/federations/:federation", (req: Request, res: Response) => {
    const { federation } = getFederationsParamValidation.parse(req.params);
    const query = getFederationMeetsQueryValidation.parse(req.query);
    const detail = federationsService.getFederation(federation, query);
    if (detail == null) throw new NotFoundError(`Federation "${federation}" not found`);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: detail,
    });
  });

  return router;
}
