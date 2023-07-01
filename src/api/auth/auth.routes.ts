import express from 'express';
import catchAsyncHandler from 'express-async-handler';

// import { validate } from '../api.middlewares';
import * as AuthControllers from './auth.controllers';

// import * as AuthValidations from './auth.validations';

const auth = express.Router();

auth.get('/auth/google', catchAsyncHandler(AuthControllers.getGoogle));

auth.get('/auth/google/callback', catchAsyncHandler(AuthControllers.getGoogleCallback));

auth.get('/auth/github', catchAsyncHandler(AuthControllers.getGithub));

auth.get('/auth/github/callback', catchAsyncHandler(AuthControllers.gitGithubCallback));

export default auth;
