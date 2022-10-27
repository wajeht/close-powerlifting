import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as StatusServices from './status.services';
import { getStatusType } from './status.validations';

export async function getStatus(req: Request<{}, {}, getStatusType>, res: Response) {
  const status = await StatusServices.getStatus(req.query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: status.cache,
    data: status.data,
  });
}
