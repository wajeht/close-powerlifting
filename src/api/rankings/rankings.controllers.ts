import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import logger from "../../utils/logger";
import { NotFoundError } from "../api.errors";
import * as RankingsServices from "./rankings.services";
import { getRankType, getRankingsType } from "./rankings.validations";

export async function getRankings(req: Request<{}, {}, getRankingsType>, res: Response) {
  const rankings = await RankingsServices.getRankings(req.query);

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "The resource was returned successfully!",
    cache: rankings?.cache,
    data: rankings?.data,
    pagination: rankings?.pagination,
  });
}

export async function getRank(req: Request<getRankType, {}, {}>, res: Response) {
  const rank = await RankingsServices.getRank(req.params);

  if (!rank) throw new NotFoundError("The resource cannot be found!");

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "The resource was returned successfully!",
    data: rank,
  });
}
