import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { X_API_KEY } from '../../config/constants';
import { getHostName } from '../../utils/helpers';
import { getAPIStatus } from './health-check.services';

export async function getHealthCheck(req: Request, res: Response) {
  const url = getHostName(req);

  // const data = await getAPIStatus({ X_API_KEY: X_API_KEY!, url });
  const data: any = [];

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'ok',
    cache: req.query?.cache,
    data,
  });
}
