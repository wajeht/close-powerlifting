import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AnyZodObject } from 'zod';

import { EMAIL, JWT_SECRET } from '../config/constants';
import mail from '../utils/mail';
import reachingApiLimitHTML from '../utils/templates/reaching-api-limit';
import { User } from '../views/views.models';
import { APICallsExceeded, UnauthorizedError } from './api.errors';

interface RequestValidators {
  params?: AnyZodObject;
  body?: AnyZodObject;
  query?: AnyZodObject;
}

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
      const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

      req.user = {
        id: decoded.id,
        name: decoded.name,
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

export async function trackAPICalls(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.user?.id;
    if (id) {
      const user = await User.findOneAndUpdate(
        { id },
        { $inc: { api_call_count: 1 } },
        { new: true },
      );

      // exceeded api call limit
      if (user?.api_call_count && user.api_call_count >= user.api_call_limit && !user.admin) {
        throw new APICallsExceeded('API Calls exceeded!');
      }

      // 50 %
      if (user?.api_call_count && user.api_call_count === user.api_call_limit / 2 && !user.admin) {
        mail.sendMail({
          from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
          to: user.email,
          subject: 'Reaching API Call Limit',
          html: reachingApiLimitHTML({ name: user.name!, percent: 50 }),
        });
      }
    }
    next();
  } catch (e) {
    next(e);
  }
}
