import axios from 'axios';
import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

import { getRankings } from '../api/rankings/rankings.services';
import { EMAIL, JWT_SECRET, PASSWORD_SALT, X_API_KEY } from '../config/constants';
import { getHostName, hashKey } from '../utils/helpers';
import logger from '../utils/logger';
import mail from '../utils/mail';
import contactHTML from '../utils/templates/contact';
import verifyEmailHTML from '../utils/templates/verify-email';
import welcomeHTML from '../utils/templates/welcome';
import { User } from './views.models';
import { resetAPIKey, resetAdminAPIKey, sendVerificationEmail } from './views.services';

export async function getHomePage(req: Request, res: Response) {
  const rankings = await getRankings({ current_page: 1, per_page: 5, cache: true });

  return res.status(StatusCodes.OK).render('home.html', {
    path: '/home',
    rankings,
  });
}

export function getRegisterPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('register.html', {
    path: '/register',
    messages: req.flash(),
  });
}

export async function postRegisterPage(
  req: Request<{}, {}, { email: string; name: string }>,
  res: Response,
) {
  const { email, name } = req.body;

  const found = await User.findOne({ email });

  if (found) {
    req.flash('error', 'Email already exist!');
    return res.redirect('/register');
  }

  const { key: token } = await hashKey();

  const createdUser = await User.create({ email, name, verification_token: token });

  const hostname = getHostName(req);

  logger.info(`user_id: ${createdUser.id} has registered an account!`);

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'Account verification',
    html: verifyEmailHTML({
      name,
      hostname,
      email,
      verification_token: createdUser.verification_token!,
    }),
  });

  logger.info(`Verification email was sent to user_id: ${createdUser.id}!`);

  req.flash('info', 'Thank you for registering. Please check your email for confirmation!');

  return res.redirect('/register');
}

export function getResetAPIKeyPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('reset-api-key.html', {
    path: '/reset-api-key',
    messages: req.flash(),
  });
}

export async function postResetAPIKeyPage(
  req: Request<{}, {}, { email: string }, {}>,
  res: Response,
) {
  const { email } = req.body;

  const [foundUser] = await User.find({ email });

  if (foundUser && foundUser.verified === false) {
    await sendVerificationEmail({
      hostname: getHostName(req),
      userId: foundUser.id!,
      name: foundUser.name!,
      email: foundUser.email!,
      verification_token: foundUser.verification_token!,
    });
  }

  if (foundUser && foundUser.verified === true && foundUser.admin === true) {
    await resetAdminAPIKey({
      userId: foundUser.id!,
      name: foundUser.name!,
      email: foundUser.email!,
    });
  } else if (foundUser && foundUser.verified === true) {
    await resetAPIKey({ userId: foundUser.id!, name: foundUser.name!, email: foundUser.email! });
  }

  req.flash('info', 'If you have an account with us, we will send you a new api key!');

  res.redirect('/reset-api-key');
}

export async function getVerifyEmailPage(req: Request, res: Response) {
  const { token, email } = req.query as { token: string; email: string };
  const [user] = await User.find({ email });

  if (!user) {
    req.flash('error', 'Something wrong while verifying your account!');
    return res.redirect('/register');
  }

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
      id: user.id,
      name: user.name,
      email,
    },
    JWT_SECRET!,
    {
      issuer: 'Close Powerlifting',
    },
  );

  const hashKey = await bcrypt.hash(key, parseInt(PASSWORD_SALT!));

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
    html: welcomeHTML({ name: verified!.name!, key }),
  });

  logger.info(`user_id: ${verified!.id} has verified email!`);

  req.flash(
    'success',
    'Thank you for verifying your email address. We just send you an API key to your email!',
  );

  return res.redirect('/register');
}

export function getContactPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('contact.html', {
    path: '/contact',
    messages: req.flash(),
  });
}

export async function postContactPage(req: Request, res: Response) {
  const { name, email, message } = req.body;

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: EMAIL.AUTH_EMAIL,
    subject: `Contact Request from ${email}`,
    html: contactHTML({ name, email, message }),
  });

  req.flash('info', "Thanks for reaching out to us. We'll get back to you shortly!");
  return res.redirect('/contact');
}

export function getTermsPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('terms.html', {
    path: '/terms',
  });
}

export function getPrivacyPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('privacy.html', {
    path: '/privacy',
  });
}

export function getAboutPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('about.html', {
    path: '/about',
  });
}

export function getStatusPage(req: Request, res: Response) {
  return res.status(StatusCodes.OK).render('status.html', {
    path: '/status',
  });
}

export async function getHealthCheckPage(req: Request, res: Response) {
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
    '/api/status',
    '/api/users?search=haack',
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
}
