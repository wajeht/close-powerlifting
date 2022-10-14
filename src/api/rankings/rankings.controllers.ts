import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RANKINGS_URL } from '../../config/constants';

import axios from '../../utils/axios';

export async function getRankings(req: Request, res: Response): Promise<any> {
  const x = `?start=0&end=100&lang=en&units=lbs`;
  const data = await (await axios.get(RANKINGS_URL + x)).data;

  return res.status(StatusCodes.OK).json({
    status: 'ok',
    data,
  });
}
