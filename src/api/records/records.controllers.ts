import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as RecordsServices from './records.services';
import { getRecordsType } from './records.validations';

export async function getRecords(req: Request<{}, {}, getRecordsType>, res: Response) {
  const records = await RecordsServices.getRecords(req.query);

  res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    cache: records?.cache,
    data: records?.data,
  });
}
