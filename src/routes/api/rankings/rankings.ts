import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { createRankingsService } from "./rankings.service";
import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.validation";

export function createRankingsRouter(context: AppContext) {
  const rankingsService = createRankingsService(context.store);
  const router = express.Router();

  /**
   * GET /api/rankings
   * @tags Rankings
   * @summary Get all rankings with optional pagination
   */
  router.get("/api/rankings", (req: Request, res: Response) => {
    const query = getRankingsValidation.parse(req.query);
    const { data, pagination } = rankingsService.getRankings(query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  });

  /**
   * GET /api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}
   * @tags Rankings
   * @summary Fully filtered rankings with custom sort
   */
  router.get(
    "/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event/:sort",
    handleFiltered,
  );
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class/:year/:event", handleFiltered);
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class/:year", handleFiltered);
  router.get("/api/rankings/filter/:equipment/:sex/:weight_class", handleFiltered);
  router.get("/api/rankings/filter/:equipment/:sex", handleFiltered);
  router.get("/api/rankings/filter/:equipment", handleFiltered);

  /**
   * GET /api/rankings/{rank}
   * @tags Rankings
   * @summary Get a single ranking by position
   */
  router.get("/api/rankings/:rank", (req: Request, res: Response) => {
    const { rank: rawRank } = getRankValidation.parse(req.params);
    const rank = parseInt(rawRank, 10);
    const data = rankingsService.getRank(rank);
    if (data == null) {
      throw new NotFoundError(
        `Rank ${rawRank} is out of range (max=${rankingsService.getMaxRank()})`,
      );
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  function handleFiltered(req: Request, res: Response): void {
    const params = getFilteredRankingsParamValidation.parse(req.params);
    const query = getFilteredRankingsQueryValidation.parse(req.query);
    const { data, pagination } = rankingsService.getFilteredRankings(params, query);
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
      pagination,
    });
  }

  return router;
}
