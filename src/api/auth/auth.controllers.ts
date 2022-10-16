import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export async function postRegister(req: Request, res: Response) {
  res.status(StatusCodes.CREATED).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
  });
}
