import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
import { UnauthorizedError } from './api.errors';
import bcrypt from 'bcryptjs';

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

/**
 * It takes a RequestValidators object, and returns a middleware function that validates the request
 * body, query, and params using the validators in the RequestValidators object
 * @param {RequestValidators} validators - RequestValidators
 * @returns A function that takes in a Request, Response, and NextFunction.
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
      next(error);
    }
  };
}

export function auth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.headers['x-api-key']) {
      throw new UnauthorizedError('You are not authorized!');
    }
    next();
  } catch (e) {
    next(e);
  }
}
