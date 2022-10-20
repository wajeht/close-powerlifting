import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ENV, EMAIL } from './config/constants';
import { ZodError, z } from 'zod';
import mail from './utils/mail';
import Keys from './utils/keys';
import { getHostName } from './utils/helpers';

/**
 * GET /
 * @tags app
 * @summary get home page
 */
export function homePageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('home.html', {
      path: '/home',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /register
 * @tags app
 * @summary get register page
 */
export function registerPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('register.html', {
      path: '/register',
      messages: req.flash(),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /register
 * @tags app
 * @summary post register page
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 */
export async function handleRegistrationRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, name } = req.body;

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

    req.flash('success', 'Thank you for registering. Please check your email for confirmation!');
    return res.redirect('/register');
  } catch (e) {
    next(e);
  }
}

/**
 * GET /verify-email?token={token}&email={email}
 * @tags app
 * @summary verify email address
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} email.token.required - the token - application/x-www-form-urlencoded
 */
export async function handleVerificationRequest(req: Request, res: Response, next: NextFunction) {
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
}

/**
 * GET /contact
 * @tags app
 * @summary get contact page
 */
export function contactPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('contact.html', {
      path: '/contact',
      messages: req.flash(),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /contact
 * @tags app
 * @summary post contact page
 * @param {string} name.query.required - the name - application/x-www-form-urlencoded
 * @param {string} email.query.required - the email - application/x-www-form-urlencoded
 * @param {string} message.query.required - the message - application/x-www-form-urlencoded
 */
export function handleContactingRequest(req: Request, res: Response, next: NextFunction) {
  try {
    req.flash('info', "Thanks for reaching out to use. We'll get back to you shortly!");
    return res.redirect('/contact');
  } catch (e) {
    next(e);
  }
}

/**
 * GET /terms
 * @tags app
 * @summary get terms page
 */
export function termsPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('terms.html', {
      path: '/terms',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /privacy
 * @tags app
 * @summary get privacy page
 */
export function privacyPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('privacy.html', {
      path: '/privacy',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /about
 * @tags app
 * @summary get about page
 */
export function aboutPageHandler(req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(StatusCodes.OK).render('about.html', {
      path: '/about',
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /health-check
 * @tags app
 * @summary get the health of close-powerlifting app
 */
export function healthCheckHandler(req: Request, res: Response, next: NextFunction) {
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
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(StatusCodes.NOT_FOUND).render('not-found.html');

  return res.status(StatusCodes.NOT_FOUND).json({
    status: 'fail',
    request_url: req.originalUrl,
    message: 'The resource does not exist!',
    cache: req.query?.cache,
    data: [],
  });
}

export function serverErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  let statusCode;

  if (err instanceof ZodError) statusCode = StatusCodes.BAD_REQUEST;
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR;

  const isApiPrefix = req.url.match(/\/api\//g);
  if (!isApiPrefix) return res.status(statusCode).render('error.html');

  return res.status(statusCode).json({
    status: 'fail',
    request_url: req.originalUrl,
    cache: req.query?.cache,
    message:
      ENV === 'development'
        ? err.stack
        : 'The server encountered an internal error or misconfiguration and was unable to complete your request.',
    errors: err?.errors,
    data: [],
  });
}
