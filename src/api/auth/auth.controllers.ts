import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export async function getGoogle(req: Request, res: Response) {
  res.json({
    msg: 'getGoogle',
  });
}

export async function getGoogleCallback(req: Request, res: Response) {
  res.json({
    msg: 'getGoogleCallback',
  });
}

export async function getGithub(req: Request, res: Response) {
  res.json({
    msg: 'getGithub',
  });
}

export async function gitGithubCallback(req: Request, res: Response) {
  res.json({
    msg: 'gitGithubCallback',
  });
}
