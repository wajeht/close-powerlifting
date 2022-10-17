import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV } from './config/constants';
import { ZodError } from 'zod';

/**
 * GET /
 * @tags app
 * @summary get home page
 */
export function homePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('home.html', {
      path: '/home',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /contact
 * @tags app
 * @summary get contact page
 */
export function contactPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('contact.html', {
      path: '/contact',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /terms
 * @tags app
 * @summary get terms page
 */
export function termsPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('terms.html', {
      path: '/terms',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /privacy
 * @tags app
 * @summary get privacy page
 */
export function privacyPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('privacy.html', {
      path: '/privacy',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /about
 * @tags app
 * @summary get about page
 */
export function aboutPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('about.html', {
      path: '/about',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /health-check
 * @tags app
 * @summary get the health of close-powerlifting app
 */
export function healthCheckHandler(req: Request, res: Response, next: NextFunction) {
  return res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'ok',
    cache: req.query?.cache,
    data: [
      {
        date: new Date(),
      },
    ],
  });
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(StatusCodes.NOT_FOUND).render('not-found.html');

  return res.status(StatusCodes.NOT_FOUND).json({
    status: 'fail',
    request_url: req.originalUrl,
    message: 'The resource does not exist!',
    cache: req.query?.cache,
    data: [],
  });
}

export function serverErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  let statusCode;

  if (err instanceof ZodError) statusCode = StatusCodes.BAD_REQUEST;
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(statusCode).render('error.html');

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message:
      ENV === 'development'
        ? err.stack
        : 'The server encountered an internal error or misconfiguration and was unable to complete your request.',
    errors: err?.errors,
    data: [],
  });
}
