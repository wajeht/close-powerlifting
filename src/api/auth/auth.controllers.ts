import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { getGitHubOAuthURL, getGoogleOAuthURL, getHostName, hashKey } from '../../utils/helpers';
import logger from '../../utils/logger';
import { User } from '../../views/views.models';
import { sendVerificationEmail, sendWelcomeEmail } from '../../views/views.services';
import { UnauthorizedError } from '../api.errors';
import { ValidationError } from '../api.errors';
import * as AuthServices from './auth.services';
import { postRegisterType } from './auth.validations';

export async function getGoogle(req: Request, res: Response) {
  res.redirect(getGoogleOAuthURL());
}

export async function getGoogleRedirect(req: Request, res: Response) {
  const code = req.query.code as string;

  if (!code) {
    // if no code is provided
    throw new UnauthorizedError('Something went wrong while authenticating with Google');
  }

  const { id_token, access_token } = await AuthServices.getGoogleOauthToken({ code });

  const googleUser = await AuthServices.getGoogleUser({
    id_token,
    access_token,
  });

  if (!googleUser.verified_email) {
    // if email is not verified
    throw new UnauthorizedError('Something went wrong while authenticating with Google');
  }

  const found = await User.findOne({ email: googleUser.email });

  if (!found) {
    const createdUser = await User.create({
      email: googleUser.email,
      name: googleUser.name,
      verification_token: access_token,
      verified: true,
      verified_at: new Date(),
    });

    sendWelcomeEmail({
      name: createdUser.name!,
      email: createdUser.email!,
      userId: createdUser.id!,
    });

    req.flash('success', 'We will send you an API key to your email very shortly!');

    return res.redirect('/register');
  }

  req.flash(
    'error',
    "Email already exist, please click on 'Forgot api key?' to request a new one!",
  );

  return res.redirect('/register');
}

export async function getGithub(req: Request, res: Response) {
  res.redirect(getGitHubOAuthURL());
}

export async function getGithubRedirect(req: Request, res: Response) {
  const code = req.query.code as string;

  if (!code) {
    // if no code is provided
    throw new UnauthorizedError('Something went wrong while authenticating with github');
  }

  const { access_token } = await AuthServices.getGithubOauthToken({ code });

  const githubUser = await AuthServices.getGithubUser({ access_token });

  const emails = await AuthServices.getGithuUserEmails({ access_token });
  const found = await User.findOne({ email: emails[0].email });

  if (!found) {
    const createdUser = await User.create({
      email: emails[0].email,
      name: githubUser.name,
      verification_token: access_token,
      verified: true,
      verified_at: new Date(),
    });

    sendWelcomeEmail({
      name: createdUser.name!,
      email: createdUser.email!,
      userId: createdUser.id!,
    });

    req.flash('success', 'We will send you an API key to your email very shortly!');

    return res.redirect('/register');
  }

  req.flash(
    'error',
    "Email already exist, please click on 'Forgot api key?' to request a new one!",
  );

  return res.redirect('/register');
}

export async function postRegister(req: Request<{}, {}, postRegisterType>, res: Response) {
  const { email, name } = req.body;

  const found = await User.findOne({ email });

  if (found) {
    throw new ValidationError('email already exist');
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

  res.status(StatusCodes.CREATED).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'Thank you for registering. Please check your email for confirmation!',
    data: null,
  });
}
