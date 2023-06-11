import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getMeetsType } from './meets.validations';

import logger from '../../utils/logger';
import * as MeetsServices from './meets.services';

export async function getMeets(req: Request<{}, {}, getMeetsType>, res: Response) {
  const meets = await MeetsServices.getMeets(req.query);

  // @ts-ignore
  logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: meets?.cache,
    data: meets?.data,
    pagination: meets?.pagination,
  });
}
