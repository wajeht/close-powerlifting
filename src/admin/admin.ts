import AdminJSExpress from '@adminjs/express';
import MongooseAdapter from '@adminjs/mongoose';
import AdminJS from 'adminjs';
import type { FeatureType, ResourceOptions } from 'adminjs';
import bcrypt from 'bcryptjs';

import {
  COOKIE_NAME,
  COOKIE_PASSWORD,
  ENV,
  SESSION_NAME,
  SESSION_SECRET,
} from '../config/constants';
import { ENV_ENUMS } from '../utils/enums';
import logger from '../utils/logger';
import { User } from '../views/views.models';
import { CreateUserResource } from './user.resource';

export type CreateResourceResult<T> = {
  resource: T;
  options: ResourceOptions;
  features?: Array<FeatureType>;
};

export type ResourceFunction<T = unknown> = () => CreateResourceResult<T>;

AdminJS.registerAdapter(MongooseAdapter);

export const adminJs = new AdminJS({
  version: { admin: true, app: '0.0.1' },
  rootPath: '/admin',
  branding: {
    companyName: 'Close Powerlifting',
  },
  resources: [CreateUserResource()],
});

export const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJs,
  {
    authenticate: async (email, password) => {
      try {
        logger.info(
          `**** account with ${email}:${password} is trying to login to admin panel ****`,
        );
        const user = await User.findOne({ email });
        if (user) {
          const matched = await bcrypt.compare(password, user.password!);
          if (matched && user.admin) {
            return user;
          }
        }
      } catch (error) {
        logger.info(`**** adminjs login failed: ${error} **** `);
      }
      return false;
    },
    cookieName: COOKIE_NAME,
    cookiePassword: COOKIE_PASSWORD,
  },
  null,
  {
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: ENV === ENV_ENUMS.PRODUCTION,
      secure: ENV === ENV_ENUMS.PRODUCTION,
    },
    name: SESSION_NAME,
  },
);
