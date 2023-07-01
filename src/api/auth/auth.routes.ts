import express from 'express';
import catchAsyncHandler from 'express-async-handler';

import * as AuthControllers from './auth.controllers';

const auth = express.Router();

auth.get('/oauth/google', catchAsyncHandler(AuthControllers.getGoogle));
auth.get('/oauth/google/redirect', catchAsyncHandler(AuthControllers.getGoogleRedirect));

auth.get('/oauth/github', catchAsyncHandler(AuthControllers.getGithub));
auth.get('/oauth/github/redirect', catchAsyncHandler(AuthControllers.getGithubRedirect));

export default auth;
