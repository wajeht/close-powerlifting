import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';
import { UnauthorizedError } from './api.errors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ENV } from '../config/constants';

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

/**
 * It checks if the request has a valid bearer token or api key, and if it does, it adds the user's
 * name and email to the request object
 * @param {Request} req - Request - The request object.
 * @param {Response} res - Response - This is the response object that we will use to send a response
 * to the client.
 * @param {NextFunction} next - NextFunction - This is a function that will be called when the
 * middleware is done.
 */
export function auth(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';

    //! -------------------------------- BEARER TOKEN AUTHENTICATION  -----------------------------
    if (req.headers.authorization) {
      if (req.headers.authorization.split(' ').length != 2) throw new UnauthorizedError('Must use bearer token authentication!'); // prettier-ignore
      if (!req.headers.authorization.startsWith('Bearer')) throw new UnauthorizedError('Must use bearer token authentication!'); // prettier-ignore
      token = req.headers.authorization.split(' ')[1];
    }
    //! -------------------------------- API TOKEN AUTHENTICATION --------------------------------
    else if (req.headers['x-api-key']) {
      token = req.headers['x-api-key'] as string;
    } else {
      throw new UnauthorizedError('Invalid authentication!');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET!);

      // @ts-ignore
      req.user = {
        // @ts-ignore
        id: decoded.id,
        // @ts-ignore
        email: decoded.name,
        // @ts-ignore
        email: decoded.email,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid signature!');
    }

    next();
  } catch (e) {
    next(e);
  }
}
