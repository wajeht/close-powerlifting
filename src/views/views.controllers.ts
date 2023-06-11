import { Request, Response } from 'express';
import { EMAIL, JWT_SECRET, PASSWORD_SALT, X_API_KEY } from '../config/constants';
import { getHostName, hashKey } from '../utils/helpers';
import { User } from './views.models';
import { StatusCodes } from 'http-status-codes';
import mail from '../utils/mail';
import jwt from 'jsonwebtoken';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import logger from '../utils/logger';
import { getRankings } from '../api/rankings/rankings.services';

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
  const created = await User.create({ email, name, verification_token: token });
  const hostname = getHostName(req);

  logger.info(`user_id: ${created.id} has registered an account!`);

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
  logger.info(`Verification email was sent to user_id: ${created.id}!`);

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

  const [user] = await User.find({ email });

  // @ts-ignore
  if (user && user.verified === false) {
    const hostname = getHostName(req);

    // email needs to verify
    const info = await mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: email,
      subject: 'Account verification',
      html: `
        <div>
          <p>Hi ${user.name},</p>
          <br>

          <p>We're happy you signed up for Close Powerlifting earlier. To start exploring, please confirm your email address.</p>

          <br>
          <a href="${hostname}/verify-email?token=${user.verification_token}&email=${email}" style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">Verify Now</a>
          <br>

          <br>
          <p>Welcome to the Close Powerlifting,</p>
          <p>Let's make all kinds of gains. All kindszzzz.!</p>
        </div>
        `,
    });

    logger.info(`Verification email was sent to user_id: ${user.id}!`);
  }

  if (user && user.verified === true && user.admin === true) {
      const password = faker.internet.password(50);
      const hashedPassword = await bcrypt.hash(password, parseInt(PASSWORD_SALT!));

      const apiKey = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        JWT_SECRET!,
        {
          issuer: 'Close Powerlifting',
        },
      );

      const hashedApiKey = await bcrypt.hash(apiKey, parseInt(PASSWORD_SALT!));

      await User.findOneAndUpdate(
        {
          email: user.email,
        },
        {
          $set: {
            key: hashedApiKey,
            password: hashedPassword
          },
        },
        {
          returnOriginal: false,
        },
      );

     await mail.sendMail({
        from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
        to: user.email,
        subject: 'New API Key and Admin Password for Close Powerlifting',
        html: `
          <div>
            <p>Hi ${user!.name},</p>
            <br>
            <p>Here below is your API key and admin password to access Close Powerlifting!</p>
            <br>
            <br>
            <p>Admin password</p>
            <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${password}</div>
            <br>
            <p>API Key:</p>
            <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${apiKey}</div>
            <br>
            <br>
            <br>
            <p>Welcome to the Close Powerlifting,</p>
            <p>Let's make all kinds of gains. All kindszzzz.!</p>
          </div>
          `,
      });

      logger.info(`**** admin user: ${user.email} has been updated! ****`);
  }

  // @ts-ignore
  else if (user && user.verified === true) {
    const key = jwt.sign(
      {
        // @ts-ignore
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
        },
      },
      {
        returnOriginal: false,
      },
    );

    const info = await mail.sendMail({
      from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
      to: email,
      subject: 'New api key for Close Powerlifting',
      html: `
      <div>
        <p>Hi ${verified!.name},</p>
        <br>

        <p>We've received a request to reset a new api key. Here below is your API key to access Close Powerlifting!</p>

        <br>
        <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${key}</div>
        <br>

        <br>
        <p>Welcome to the Close Powerlifting,</p>
        <p>Let's make all kinds of gains. All kindszzzz.!</p>
      </div>
      `,
    });
  }

  logger.info(`Reset api email was sent to email: ${email}!`);

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
