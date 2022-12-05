import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import logger from '../../utils/logger';

import * as UsersServices from './users.services';
import { getUserType, getUsersType } from './users.validations';

/**
 * It gets a user from the database and returns it to the client
 * @param req - Request<getUserType, {}, {}>
 * @param {Response} res - Response - This is the response object that will be returned to the client.
 */
export async function getUser(req: Request<getUserType, {}, {}>, res: Response) {
  const user = await UsersServices.getUser(req.params);

  // @ts-ignore
  logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: user,
  });
}

/**
 * It gets a list of users from the database
 * @param req - Request<getUsersType, {}, {}>
 * @param {Response} res - Response - This is the response object that we will use to send back the
 * response to the client.
 * @returns a redirect to the /api/rankings endpoint.
 */
export async function getUsers(req: Request<getUsersType, {}, {}>, res: Response) {
  if (req.query.search) {
    const searched = await UsersServices.searchUser(req.query);

    // @ts-ignore
    logger.info(`user_id: ${req?.user?.id} has called ${req.originalUrl}`);

    res.status(StatusCodes.OK).json({
      status: 'success',
      request_url: req.originalUrl,
      message: 'The resource was returned successfully!',
      data: searched?.data || [],
    });

    return;
  }

  res.status(StatusCodes.PERMANENT_REDIRECT).redirect('/api/rankings');
}
