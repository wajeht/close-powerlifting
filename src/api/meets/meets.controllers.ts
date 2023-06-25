import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import logger from '../../utils/logger';
import { NotFoundError } from '../api.errors';
import * as MeetsServices from './meets.services';
import { getFederationsType, getMeetsType } from './meets.validations';

export async function getMeets(req: Request<{}, {}, getMeetsType>, res: Response) {
  const meets = await MeetsServices.getMeets(req.query);

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: meets?.cache,
    data: meets?.data,
    pagination: meets?.pagination,
  });
}

export async function getFederations(req: Request<getFederationsType, {}, {}>, res: Response) {
  const federations = await MeetsServices.getFederations(req.params);

  if (!federations) throw new NotFoundError('The resource cannot be found!');

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: federations,
  });
}
