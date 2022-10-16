import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as RankingsServices from './rankings.services';
import { getRankingsType } from './rankings.validations';

export async function getRankings(req: Request<{}, {}, getRankingsType>, res: Response) {
  const rankings = await RankingsServices.getRankings(req.query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: req.query.cache,
    data: rankings,
  });
}
