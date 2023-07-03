import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import * as AuthControllers from './auth.controllers';

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

export default auth;
