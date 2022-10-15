import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as RankingsServices from './rankings.services';
import { getRankingsType } from './rankings.validations';

export async function getRankings(req: Request<{}, {}, getRankingsType>, res: Response) {
  const { per_page, current_page, cache } = req.query;

  const rankings = await RankingsServices.getRankings();

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: cache || false,
    data: rankings,
  });
}
