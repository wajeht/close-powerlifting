import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as RankingsServices from './rankings.services';
import { getRankType, getRankingsType } from './rankings.validations';

/**
 * It gets the rankings from the RankingsServices class and returns the response to the client
 * @param req - Request<{}, {}, getRankingsType>
 * @param {Response} res - Response - This is the response object that will be returned to the client.
 */
export async function getRankings(req: Request<{}, {}, getRankingsType>, res: Response) {
  const rankings = await RankingsServices.getRankings(req.query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: rankings?.cache,
    data: rankings?.data,
    pagination: rankings?.pagination,
  });
}

export async function getRank(req: Request<getRankType, {}, {}>, res: Response) {
  const data = await RankingsServices.getRank(req.params);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data,
  });
}
