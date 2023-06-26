import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import logger from '../../utils/logger';
import { NotFoundError } from '../api.errors';
import * as MeetsServices from './meets.services';
import { getMeetType } from './meets.validations';

export async function getMeet(req: Request<getMeetType, {}, {}>, res: Response) {
  const rank = await MeetsServices.getMeet();

  if (!rank) throw new NotFoundError('The resource cannot be found!');

  logger.info(`user_id: ${req.user.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: rank,
  });
}
