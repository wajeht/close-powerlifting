import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function healthCheckHandler(req: Request, res: Response, next: NextFunction) {
  return res.status(StatusCodes.OK).json({
    message: 'ok',
    date: new Date(),
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  return res.status(StatusCodes.NOT_FOUND).json({
    message: 'not found!',
  });
}

export function serverErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: err.message,
  });
}
