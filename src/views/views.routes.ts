import express from 'express';
import catchAsyncHandler from 'express-async-handler';
import { z } from 'zod';

import { validationMiddleware } from '../app.middlewares';
import {
  getHomePage,
  getRegisterPage,
  postRegisterPage,
  getResetAPIKeyPage,
  postResetAPIKeyPage,
  getVerifyEmailPage,
  getContactPage,
  postContactPage,
  getTermsPage,
  getPrivacyPage,
  getAboutPage,
  getStatusPage,
  getHealthCheck,
} from './views.controllers';

const views = express.Router();

/**
 * GET /
 * @tags views
 * @summary get home page
 */
views.get('/', catchAsyncHandler(getHomePage));

/**
 * GET /register
 * @tags views
 * @summary get register page
 */
views.get('/register', catchAsyncHandler(getRegisterPage));

/**
 * POST /register
 * @tags views
 * @summary post register page
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} name.query.required - the name - application/x-www-form-urlencoded
 */
views.post(
  '/register',
  validationMiddleware({
    body: z.object({
      email: z
        .string({ required_error: 'email is required!' })
        .email({ message: 'must be a valid email address!' }),
      name: z.string({ required_error: 'name is required!' }),
    }),
  }),
  catchAsyncHandler(postRegisterPage),
);

/**
 * GET /reset-api-key
 * @tags views
 * @summary reset/forgot your api key
 */
views.get('/reset-api-key', catchAsyncHandler(getResetAPIKeyPage));

/**
 * POST /reset-api-key
 * @tags views
 * @summary reset/forgot your api key
 * @param {string} request.body.required - the email - application/x-www-form-urlencoded
 */
views.post(
  '/reset-api-key',
  validationMiddleware({
    body: z.object({
      email: z
        .string({
          required_error: 'email address required!',
        })
        .email({
          message: 'must be a valid email address!',
        }),
    }),
  }),
  catchAsyncHandler(postResetAPIKeyPage),
);

/**
 * GET /verify-email?token={token}&email={email}
 * @tags views
 * @summary verify email address
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} email.token.required - the token - application/x-www-form-urlencoded
 */
views.get(
  '/verify-email',
  // validate({
  //   query: z.object({
  //     token: z.string().optional(),
  //     email: z.string().email().optional(),
  //   }),
  // }),
  catchAsyncHandler(getVerifyEmailPage),
);

/**
 * GET /contact
 * @tags views
 * @summary get contact page
 */
views.get('/contact', catchAsyncHandler(getContactPage));

/**
 * POST /contact
 * @tags views
 * @summary post contact page
 * @param {string} name.query.required - the name - application/x-www-form-urlencoded
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} message.query.required - the message - application/x-www-form-urlencoded
 */
views.post(
  '/contact',
  validationMiddleware({
    body: z.object({
      email: z
        .string({ required_error: 'email is required!' })
        .email({ message: 'must be valid email address!' }),
      name: z.string({ required_error: 'name is required!' }),
      message: z.string({ required_error: 'message is required!' }),
    }),
  }),
  catchAsyncHandler(postContactPage),
);

/**
 * GET /terms
 * @tags views
 * @summary get terms page
 */
views.get('/terms', catchAsyncHandler(getTermsPage));

/**
 * GET /privacy
 * @tags views
 * @summary get privacy page
 */
views.get('/privacy', catchAsyncHandler(getPrivacyPage));

/**
 * GET /about
 * @tags views
 * @summary get about page
 */
views.get('/about', catchAsyncHandler(getAboutPage));

/**
 * GET /status
 * @tags views
 * @summary get status page
 */
views.get('/status', catchAsyncHandler(getStatusPage));

/**
 * GET /health-check
 * @tags views
 * @summary get the health of close-powerlifting app
 */
views.get('/health-check', catchAsyncHandler(getHealthCheck));

export default views;
