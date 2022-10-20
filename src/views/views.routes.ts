import express, { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { EMAIL } from '../config/constants';
import mail from '../utils/mail';
import Keys from '../utils/keys';
import { getHostName } from '../utils/helpers';

import { Users, User, UserWithId } from './views.models';
import { z } from 'zod';

const views = express.Router();

/**
 * GET /
 * @tags views
 * @summary get home page
 */
views.get('/', function (req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('home.html', {
      path: '/home',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /register
 * @tags views
 * @summary get register page
 */
views.get(
  '/register',
  function registerPageHandler(req: Request, res: Response, next: NextFunction) {
    try {
      return res.status(StatusCodes.OK).render('register.html', {
        path: '/register',
        messages: req.flash(),
      });
    } catch (e) {
      next(e);
    }
  },
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
  async function handleRegistrationRequest(
    req: Request<{}, UserWithId, User>,
    res: Response<UserWithId>,
    next: NextFunction,
  ) {
    try {
      const { email, name } = req.body;

      const user = Users.insertOne(req.body);

      const found = await Keys.find(email);

      if (found) {
        req.flash('error', 'Email already exist!');
        return res.redirect('/register');
      }

      const created = await Keys.create(email, name);
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

      // console.log(info.messageId);

      req.flash('info', 'Thank you for registering. Please check your email for confirmation!');
      return res.redirect('/register');
    } catch (e) {
      next(e);
    }
  },
);

/**
 * GET /verify-email?token={token}&email={email}
 * @tags views
 * @summary verify email address
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} email.token.required - the token - application/x-www-form-urlencoded
 */
views.get(
  '/verify',
  async function handleVerificationRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.query.email as string;
      const token = req.query.token as string;

      const user = await Keys.find(email);

      if (!user) {
        req.flash('error', 'Something wrong while verifying your account!');
        return res.redirect('/register');
      }

      if (user.verification_token !== token) {
        req.flash('error', 'Something wrong while verifying your account!');
        return res.redirect('/register');
      }

      const verified = await Keys.verify(email);

      const info = await mail.sendMail({
        from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
        to: email,
        subject: 'API Key for Close Powerlifting',
        html: `
      <div>
        <p>Hi ${verified.name},</p>
        <br>

        <p>Thank your verifying your email address. Here below is your API key to access Close Powerlifting!</p>

        <br>
        <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${verified.key}</div>
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
    } catch (e) {
      console.log(e);
      next(e);
    }
  },
);

/**
 * GET /contact
 * @tags views
 * @summary get contact page
 */
views.get('/contact', function contactPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('contact.html', {
      path: '/contact',
      messages: req.flash(),
    });
  } catch (e) {
    next(e);
  }
});

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
  async function handleContactingRequest(req: Request, res: Response, next: NextFunction) {
    try {
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
    } catch (e) {
      next(e);
    }
  },
);

/**
 * GET /terms
 * @tags views
 * @summary get terms page
 */
views.get('/terms', function termsPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('terms.html', {
      path: '/terms',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /privacy
 * @tags views
 * @summary get privacy page
 */
views.get('/privacy', function privacyPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('privacy.html', {
      path: '/privacy',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /status
 * @tags views
 * @summary get status page
 */
views.get('/status', function statusPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('status.html', {
      path: '/status',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /about
 * @tags views
 * @summary get about page
 */
views.get('/about', function aboutPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('about.html', {
      path: '/about',
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /health-check
 * @tags views
 * @summary get the health of close-powerlifting app
 */
views.get(
  '/health-check',
  function healthCheckHandler(req: Request, res: Response, next: NextFunction) {
    return res.status(StatusCodes.OK).json({
      status: 'success',
      request_url: req.originalUrl,
      message: 'ok',
      cache: req.query?.cache,
      data: [
        {
          date: new Date(),
        },
      ],
    });
  },
);

export default views;