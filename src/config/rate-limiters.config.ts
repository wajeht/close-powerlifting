import { ENV_ENUMS } from '../utils/enums';
import { ENV } from './constants';
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

function apiRateLimitHandler(req: Request, res: Response) {
  if (req.get('Content-Type') === 'application/json') {
    return res.json({
      status: 'fail',
      request_url: req.originalUrl,
      message: 'Too many requests, please try again later?',
      data: [],
    });
  }
  return res.render('./rate-limit.html');
}

export const api = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,
  message: apiRateLimitHandler,
  skip: () => ENV !== ENV_ENUMS.PRODUCTION,
});

export const app = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 50, // Limit each IP to 50 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: apiRateLimitHandler,
  skip: () => ENV !== ENV_ENUMS.PRODUCTION,
});
