import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import logger from "../../utils/logger";
import { NotFoundError } from "../api.errors";
import * as RecordsServices from "./records.services";
import { getRecordsType } from "./records.validations";

export async function getRecords(req: Request<{}, {}, getRecordsType>, res: Response) {
  const records = await RecordsServices.getRecords(req.query);

  if (!records) throw new NotFoundError("The resource cannot be found!");

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "The resource was returned successfully!",
    cache: records?.cache,
    data: records?.data,
  });
}
