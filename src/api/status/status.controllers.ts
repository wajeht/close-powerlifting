import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as StatusServices from './status.services';

export async function getStatus(req: Request, res: Response) {
  const status = await StatusServices.getStatus();

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: status,
  });
}
