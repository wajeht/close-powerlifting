import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

export async function getHealthCheck(req: Request, res: Response) {
  const data: any = [];

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message: "ok",
    cache: req.query?.cache,
    data,
  });
}
