import express, { NextFunction, Request, Response } from 'express';
import catchAsyncHandler from 'express-async-handler';
import { StatusCodes } from 'http-status-codes';
import { EMAIL, JWT_SECRET, PASSWORD_SALT, X_API_KEY } from '../config/constants';
import mail from '../utils/mail';
import { getHostName, hashKey } from '../utils/helpers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';

import { User } from './views.models';

const views = express.Router();

/**
 * GET /
 * @tags views
 * @summary get home page
 */
views.get(
  '/',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('home.html', {
      path: '/home',
    });
  }),
);

/**
 * GET /register
 * @tags views
 * @summary get register page
 */
views.get(
  '/register',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('register.html', {
      path: '/register',
      messages: req.flash(),
    });
  }),
);

/**
 * POST /register
 * @tags views
 * @summary post register page
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} name.query.required - the name - application/x-www-form-urlencoded
 */
views.post(
  '/register',
  catchAsyncHandler(async (req: Request, res: Response) => {
    const { email, name } = req.body;

    const found = await User.findOne({ email });

    if (found) {
      req.flash('error', 'Email already exist!');
      return res.redirect('/register');
    }

    const { key: token } = await hashKey();
    const created = await User.create({ email, name, verification_token: token });
    const hostname = getHostName(req);

    const info = await mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: email,
      subject: 'Account verification',
      html: `
      <div>
        <p>Hi ${name},</p>
        <br>

        <p>We're happy you signed up for Close Powerlifting. To start exploring, please confirm your email address.</p>

        <br>
        <a href="${hostname}/verify-email?token=${created.verification_token}&email=${email}" style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">Verify Now</a>
        <br>

        <br>
        <p>Welcome to the Close Powerlifting,</p>
        <p>Let's make all kinds of gains. All kindszzzz.!</p>
      </div>
      `,
    });

    console.log(info.messageId);

    req.flash('info', 'Thank you for registering. Please check your email for confirmation!');
    return res.redirect('/register');
  }),
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
  catchAsyncHandler(async (req: Request, res: Response) => {
    const email = req.query.email as string;
    const token = req.query.token as string;

    const [user] = await User.find({ email });

    if (!user) {
      req.flash('error', 'Something wrong while verifying your account!');
      return res.redirect('/register');
    }

    // @ts-ignore
    if (user.verification_token !== token) {
      req.flash('error', 'Something wrong while verifying your account!');
      return res.redirect('/register');
    }

    if (user.verified === true) {
      req.flash('error', 'This e-mail has already been used for verification!');
      return res.redirect('/register');
    }

    const key = jwt.sign(
      {
        name: user.name,
        email,
      },
      JWT_SECRET!,
      {
        issuer: 'Close Powerlifting',
      },
    );

    const hashKey = await bcrypt.hash(key, parseInt(PASSWORD_SALT!));

    // const verified = await Keys.verify(email);
    let verified = await User.findOneAndUpdate(
      {
        email,
      },
      {
        $set: {
          key: hashKey,
          verified: true,
          verified_at: new Date().toISOString(),
        },
      },
      {
        returnOriginal: false,
      },
    );

    const info = await mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: email,
      subject: 'API Key for Close Powerlifting',
      html: `
      <div>
        <p>Hi ${verified!.name},</p>
        <br>

        <p>Thank your verifying your email address. Here below is your API key to access Close Powerlifting!</p>

        <br>
        <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${key}</div>
        <br>

        <br>
        <p>Welcome to the Close Powerlifting,</p>
        <p>Let's make all kinds of gains. All kindszzzz.!</p>
      </div>
      `,
    });

    req.flash(
      'success',
      'Thank you for verifying your email address. We just send you an API key to your email!',
    );

    return res.redirect('/register');
  }),
);

/**
 * GET /contact
 * @tags views
 * @summary get contact page
 */
views.get(
  '/contact',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('contact.html', {
      path: '/contact',
      messages: req.flash(),
    });
  }),
);

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
  catchAsyncHandler(async (req: Request, res: Response) => {
    const { name, email, message } = req.body;

    const info = await mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: EMAIL.AUTH_EMAIL,
      subject: `Contact Request from ${email}`,
      html: `
      <div>
      <p><span style="font-weight: bold;">Name:</span> ${name}</p>
      <p><span style="font-weight: bold;">Email:</span> ${email}</p>
      <p><span style="font-weight: bold;">Message:</span> ${message}</p>
      </div>
      `,
    });

    req.flash('info', "Thanks for reaching out to us. We'll get back to you shortly!");
    return res.redirect('/contact');
  }),
);

/**
 * GET /terms
 * @tags views
 * @summary get terms page
 */
views.get(
  '/terms',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('terms.html', {
      path: '/terms',
    });
  }),
);

/**
 * GET /privacy
 * @tags views
 * @summary get privacy page
 */
views.get(
  '/privacy',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('privacy.html', {
      path: '/privacy',
    });
  }),
);

/**
 * GET /about
 * @tags views
 * @summary get about page
 */
views.get(
  '/about',
  catchAsyncHandler((req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('about.html', {
      path: '/about',
    });
  }),
);

/**
 * GET /status
 * @tags views
 * @summary get status page
 */
views.get(
  '/status',
  catchAsyncHandler(async (req: Request, res: Response) => {
    return res.status(StatusCodes.OK).render('status.html', {
      path: '/status',
    });
  }),
);

/**
 * GET /health-check
 * @tags views
 * @summary get the health of close-powerlifting app
 */
views.get(
  '/health-check',
  catchAsyncHandler(async (req: Request, res: Response) => {
    const url = getHostName(req);
    const fetch = axios.create({
      baseURL: url,
      headers: {
        authorization: `Bearer ${X_API_KEY}`,
      },
    });

    const routes = [
      '/api/rankings',
      '/api/rankings/1',
      '/api/rankings?current_page=1&per_page=100&cache=false',
      '/api/meets',
      '/api/meets?current_page=1&per_page=100&cache=false',
      '/api/records',
      '/api/users/johnhaack',
    ];

    const promises = await Promise.allSettled(routes.map((r) => fetch(r)));

    const data = promises.map((p) => {
      return {
        status: p.status === 'fulfilled',
        // @ts-ignore
        method: p?.value?.config.method?.toUpperCase() ?? p?.reason?.config.method?.toUpperCase(),
        // @ts-ignore
        url: p?.value?.config?.url ?? p?.reason?.config?.url,
        // @ts-ignore
        date: p?.value?.headers?.date ?? p?.reason?.response?.headers?.date,
      };
    });

    res.status(StatusCodes.OK).json({
      status: 'success',
      request_url: req.originalUrl,
      message: 'ok',
      cache: req.query?.cache,
      data,
    });
  }),
);

export default views;
