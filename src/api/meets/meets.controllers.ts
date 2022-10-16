import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as MeetsServices from './meets.services';
import { getMeetsType } from './meets.validations';

export async function getMeets(req: Request<{}, {}, getMeetsType>, res: Response) {
  const meets = await MeetsServices.getMeets(req.query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: meets?.cache,
    data: meets?.data,
    pagination: meets?.pagination,
  });
}
