import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';

import { getRankings } from '../api/rankings/rankings.services';
import { EMAIL } from '../config/constants';
import { isCronServiceStarted } from '../utils/crons';
import { getHostName, hashKey } from '../utils/helpers';
import logger from '../utils/logger';
import mail from '../utils/mail';
// @ts-ignore
import redis from '../utils/redis';
import contactHTML from '../utils/templates/contact';
import { User } from './views.models';
import {
  resetAPIKey,
  resetAdminAPIKey,
  sendVerificationEmail,
  sendWelcomeEmail,
} from './views.services';

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

  sendVerificationEmail({
    name,
    email,
    verification_token: token,
    hostname,
    userId: createdUser.id,
  });

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
    sendVerificationEmail({
      hostname: getHostName(req),
      userId: foundUser.id!,
      name: foundUser.name!,
      email: foundUser.email!,
      verification_token: foundUser.verification_token!,
    });
  }

  if (foundUser && foundUser.verified === true && foundUser.admin === true) {
    resetAdminAPIKey({
      userId: foundUser.id!,
      name: foundUser.name!,
      email: foundUser.email!,
    });
  } else if (foundUser && foundUser.verified === true) {
    resetAPIKey({ userId: foundUser.id!, name: foundUser.name!, email: foundUser.email! });
  }

  req.flash('info', 'If you have an account with us, we will send you a new api key!');

  res.redirect('/reset-api-key');
}

export async function getVerifyEmailPage(req: Request, res: Response) {
  const { token, email } = req.query as { token: string; email: string };
  let foundUser = await User.findOne({ email });

  if (!foundUser) {
    req.flash('error', 'Something wrong while verifying your account!');
    return res.redirect('/register');
  }

  if (foundUser.verification_token !== token) {
    req.flash('error', 'Something wrong while verifying your account!');
    return res.redirect('/register');
  }

  if (foundUser.verified === true) {
    req.flash('error', 'This e-mail has already been used for verification!');
    return res.redirect('/register');
  }

  sendWelcomeEmail({ name: foundUser.name!, email: foundUser.email!, userId: foundUser.id! });

  req.flash(
    'success',
    'Thank you for verifying your email address. We will send you an API key to your email very shortly!',
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

  mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: EMAIL.AUTH_EMAIL,
    subject: `Contact Request from ${email}`,
    html: contactHTML({ name, email, message }),
  });

  req.flash('info', "Thanks for reaching out to us. We'll get back to you shortly!");

  return res.status(StatusCodes.TEMPORARY_REDIRECT).redirect('/contact');
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

export function getHealthCheck(req: Request, res: Response) {
  // mongo
  // 0: disconnected
  // 1: connected
  // 2: connecting
  // 3: disconnecting
  res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    // @ts-ignore
    redis: redis.status === 'ready' ? 'connected' : 'disconnected',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    crons: isCronServiceStarted() ? 'started' : 'stopped',
  });
}
