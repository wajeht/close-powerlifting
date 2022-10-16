import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import axios from '../../utils/axios';

export async function getMeets(req: Request, res: Response) {
  res.json({
    msg: 'ok',
  });
}
