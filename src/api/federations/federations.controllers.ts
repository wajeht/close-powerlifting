import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import logger from "../../utils/logger";
import { NotFoundError } from "../api.errors";
import * as FederationsServices from "./federations.services";
import {
  getFederationsParamType,
  getFederationsQueryType,
  getFederationsType,
} from "./federations.validations";

export async function getFederations(req: Request<{}, {}, getFederationsType>, res: Response) {
  const federations = await FederationsServices.getFederations(req.query);

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "The resource was returned successfully!",
    cache: federations?.cache,
    data: federations?.data,
    pagination: federations?.pagination,
  });
}

export async function getFederation(
  req: Request<getFederationsParamType, {}, getFederationsQueryType>,
  res: Response,
) {
  const federations = await FederationsServices.getFederation({ ...req.params, ...req.query });

  if (!federations) throw new NotFoundError("The resource cannot be found!");

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "The resource was returned successfully!",
    cache: federations?.cache,
    data: federations?.data,
  });
}
