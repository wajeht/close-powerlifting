import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV } from './config/constants';
import { ZodError, z } from 'zod';
import { UnauthorizedError } from './api/api.errors';

/**
 * If the request URL does not contain the `/api/` prefix, then render the `not-found.html` template,
 * otherwise return a JSON response
 * @param {Request} req - Request - The request object
 * @param {Response} res - Response - The response object
 * @param {NextFunction} next - NextFunction - This is a function that will be called when the
 * middleware is done.
 * @returns A function that takes in a request, response, and next function.
 */
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

/**
 * If the request is not an API request, render the error page, otherwise return a JSON response with
 * the error message
 * @param {any} err - any - The error object that was thrown.
 * @param {Request} req - The request object.
 * @param {Response} res - Response - The response object
 * @param {NextFunction} next - The next middleware function in the stack.
 * @returns A function that takes in 4 parameters.
 */
export function serverErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  let statusCode;
  let message;

  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  message =
    ENV === 'development'
      ? err.stack
      : 'The server encountered an internal error or misconfiguration and was unable to complete your request!';

  if (err instanceof ZodError) {
    statusCode = StatusCodes.BAD_REQUEST;
    message = err.message;
  }

  if (err instanceof UnauthorizedError) {
    statusCode = StatusCodes.UNAUTHORIZED;
    message = err.message;
  }

  const isApiPrefix = req.url.match(/\/api\//g);
  const isHealthcheck = req.originalUrl === '/health-check';
  if (!isApiPrefix && !isHealthcheck)
    return res.status(statusCode).render('error.html', {
      error: ENV === 'development' ? err.stack : null,
    });

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message,
    errors: err?.errors,
    data: [],
  });
}
