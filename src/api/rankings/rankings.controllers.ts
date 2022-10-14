import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as RankingsServices from './rankings.services';

export async function getRankings(req: Request, res: Response): Promise<any> {
  const { per_page, current_page, cache } = req.query;

  const rankings = await RankingsServices.getRankings({ per_page, current_page, cache });

  return res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: cache || false,
    data: rankings,
  });
}
