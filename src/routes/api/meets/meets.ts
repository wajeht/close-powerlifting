import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createMeetsService } from "./meets.service";
import {
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.validation";

export function createMeetsRouter(context: AppContext) {
  const meetsService = createMeetsService(context.store);
  const router = express.Router();

  /**
   * GET /api/meets
   * @tags Meets
   * @summary List meets across federations
   */
  router.get("/api/meets", (req: Request, res: Response) => {
    const query = listMeetsQueryValidation.parse(req.query);
    const { data, pagination } = meetsService.listMeets(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}/highlights
   * @tags Meets
   * @summary Get meet highlights
   */
  router.get("/api/meets/:federation/:date/:slug/highlights", (req: Request, res: Response) => {
    const params = getMeetParamValidation.parse(req.params);
    const query = getMeetHighlightsQueryValidation.parse(req.query);
    const result = meetsService.getMeetHighlights(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result,
    });
  });

  /**
   * GET /api/meets/{federation}/{date}/{slug}
   * @tags Meets
   * @summary Get meet results
   */
  router.get("/api/meets/:federation/:date/:slug", (req: Request, res: Response) => {
    const params = getMeetParamValidation.parse(req.params);
    const query = getMeetQueryValidation.parse(req.query);
    const result = meetsService.getMeet(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data: result,
    });
  });

  return router;
}
