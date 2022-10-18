import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as UsersServices from './users.services';
import { getUserType } from './users.validations';

export async function getUser(req: Request<getUserType, {}, {}>, res: Response) {
  const user = await UsersServices.getUser(req.params);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: user,
  });
}
