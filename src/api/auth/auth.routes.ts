import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validate } from '../api.middlewares';
import * as AuthControllers from './auth.controllers';
import * as AuthValidation from './auth.validations';

const auth = express.Router();

/**
 * GET /api/auth/oauth/google
 * @tags auth
 * @summary get google oauth url
 */
auth.get('/oauth/google', catchAsyncHandler(AuthControllers.getGoogle));

/**
 * GET /api/auth/oauth/google/redirect
 * @tags auth
 * @summary get google oauth redirect url
 */
auth.get('/oauth/google/redirect', catchAsyncHandler(AuthControllers.getGoogleRedirect));

/**
 * GET /api/auth/oauth/github
 * @tags auth
 * @summary get github oauth url
 */
auth.get('/oauth/github', catchAsyncHandler(AuthControllers.getGithub));

/**
 * GET /api/auth/oauth/github/redirect
 * @tags auth
 * @summary get github oauth redirect url
 */
auth.get('/oauth/github/redirect', catchAsyncHandler(AuthControllers.getGithubRedirect));

/**
 * POST /api/auth/register
 * @tags auth
 * @summary post register
 * @param {string} email.form.required - the email - application/x-www-form-urlencoded
 * @param {string} name.form.required - the name - application/x-www-form-urlencoded
 */
auth.post(
  '/register',
  validate({ body: AuthValidation.postRegisterValidation }),
  catchAsyncHandler(AuthControllers.postRegister),
);

/**
 * POST /api/auth/verify-email
 * @tags auth
 * @summary post verify email
 * @param {string} email.form.required - the email - application/x-www-form-urlencoded
 * @param {string} token.form.required - the token - application/x-www-form-urlencoded
 */
auth.post(
  '/verify-email',
  validate({ body: AuthValidation.postVerifyEmailValidation }),
  catchAsyncHandler(AuthControllers.postVerifyEmail),
);

/**
 * POST /api/auth/reset-api-key
 * @tags auth
 * @summary post reset api key
 * @param {string} email.form.required - the email - application/x-www-form-urlencoded
 */
auth.post(
  '/reset-api-key',
  validate({ body: AuthValidation.postResetApiKeyValidation }),
  catchAsyncHandler(AuthControllers.postResetApiKey),
);

export default auth;
