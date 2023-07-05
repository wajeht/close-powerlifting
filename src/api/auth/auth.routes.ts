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

export default auth;
