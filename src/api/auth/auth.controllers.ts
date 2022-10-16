import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export async function postRegister(req: Request, res: Response) {
  res.status(StatusCodes.CREATED).json({ msg: 'ok' });
}
