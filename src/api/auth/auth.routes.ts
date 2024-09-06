import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import { validationMiddleware } from '../api.middlewares';
import {
  postRegisterValidation,
  postResetApiKeyValidation,
  postVerifyEmailValidation,
} from './auth.validations';
import {
  getGithub,
  getGithubRedirect,
  getGoogle,
  getGoogleRedirect,
  postRegister,
  postResetApiKey,
  postVerifyEmail,
} from './auth.controllers';

const auth = express.Router();

/**
 * GET /api/auth/oauth/google
 * @tags auth
 * @summary get google oauth url
 */
auth.get('/oauth/google', catchAsyncHandler(getGoogle));

/**
 * GET /api/auth/oauth/google/redirect
 * @tags auth
 * @summary get google oauth redirect url
 */
auth.get('/oauth/google/redirect', catchAsyncHandler(getGoogleRedirect));

/**
 * GET /api/auth/oauth/github
 * @tags auth
 * @summary get github oauth url
 */
auth.get('/oauth/github', catchAsyncHandler(getGithub));

/**
 * GET /api/auth/oauth/github/redirect
 * @tags auth
 * @summary get github oauth redirect url
 */
auth.get('/oauth/github/redirect', catchAsyncHandler(getGithubRedirect));

/**
 * POST /api/auth/register
 * @tags auth
 * @summary post register
 * @param {string} email.form.required - the email - application/x-www-form-urlencoded
 * @param {string} name.form.required - the name - application/x-www-form-urlencoded
 */
auth.post(
  '/register',
  validationMiddleware({ body: postRegisterValidation }),
  catchAsyncHandler(postRegister),
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
  validationMiddleware({ body: postVerifyEmailValidation }),
  catchAsyncHandler(postVerifyEmail),
);

/**
 * POST /api/auth/reset-api-key
 * @tags auth
 * @summary post reset api key
 * @param {string} email.form.required - the email - application/x-www-form-urlencoded
 */
auth.post(
  '/reset-api-key',
  validationMiddleware({ body: postResetApiKeyValidation }),
  catchAsyncHandler(postResetApiKey),
);

export default auth;
