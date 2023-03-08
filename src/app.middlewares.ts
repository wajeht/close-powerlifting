import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV } from './config/constants';
import { ZodError, z } from 'zod';
import { UnauthorizedError } from './api/api.errors';
import { AnyZodObject } from 'zod';
import logger from './utils/logger';
import { ENV_ENUMS } from './utils/enums';

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

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
  let statusCode;
  let message;

  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  message =
    ENV === ENV_ENUMS.DEVELOPMENT
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
      error: ENV ===  ENV_ENUMS.DEVELOPMENT ? err.stack : null,
    });

  logger.error(err);

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message,
    errors: err?.errors,
    data: [],
  });
}

/**
 * It takes a `RequestValidators` object, which is a type that contains three optional properties:
 * `params`, `body`, and `query`. Each of these properties is a Zod schema. If any of these properties
 * are present, the function will attempt to validate the corresponding property on the `Request`
 * object. If validation fails, the function will redirect the user to the original URL with a flash
 * message containing the validation errors. If validation succeeds, the function will call `next()` to
 * continue the middleware chain
 * @param {RequestValidators} validators - RequestValidators
 * @returns A function that takes in a request, response, and next function.
 */
export function validate(validators: RequestValidators) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (validators.params) {
        req.params = await validators.params.parseAsync(req.params);
      }
      if (validators.body) {
        req.body = await validators.body.parseAsync(req.body);
      }
      if (validators.query) {
        req.query = await validators.query.parseAsync(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        req.flash('error', error.issues.map((e) => e.message).join(' '));
        return res.status(StatusCodes.BAD_REQUEST).redirect(req.originalUrl);
      }
      next();
    }
  };
}
