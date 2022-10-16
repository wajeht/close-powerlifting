import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as AuthControllers from './auth.controllers';
import * as AuthValidation from './auth.validations';

import express from 'express';
const auth = express.Router();

/**
 * POST /api/auth/register
 * @tags auth
 * @summary register for api keys
 * @param {email} email.query.required - the email - application/x-www-form-urlencoded
 */
auth.post(
  '/register',
  validate({ body: AuthValidation.postRegister }),
  catchAsyncHandler(AuthControllers.postRegister),
);

export default auth;
