import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { Request } from 'express';
import jwt from 'jsonwebtoken';

import { EMAIL, JWT_SECRET, PASSWORD_SALT } from '../config/constants';
import { getHostName, hashKey } from '../utils/helpers';
import logger from '../utils/logger';
import mail from '../utils/mail';
import adminNewAPIKeyHTML from '../utils/templates/admin-new-api-key';
import newAPIKeyHTML from '../utils/templates/new-api-key';
import verifyEmailHTML from '../utils/templates/verify-email';
import { User } from './views.models';

type UserParams = {
  userId: string;
  name: string;
  email: string;
};

export async function resetAPIKey({ userId, name, email }: UserParams): Promise<void> {
  const key = jwt.sign(
    {
      id: userId,
      name,
      email,
    },
    JWT_SECRET!,
    {
      issuer: 'Close Powerlifting',
    },
  );

  const hashKey = await bcrypt.hash(key, parseInt(PASSWORD_SALT!));

  const verified = await User.findOneAndUpdate(
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

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'New API key for Close Powerlifting',
    html: newAPIKeyHTML({ name: verified!.name!, key }),
  });

  logger.info(`Reset API email was sent to email: ${email}!`);
}

export async function resetAdminAPIKey({ userId, name, email }: UserParams): Promise<void> {
  const password = faker.internet.password(50);
  const hashedPassword = await bcrypt.hash(password, parseInt(PASSWORD_SALT!));

  const apiKey = jwt.sign(
    {
      id: userId,
      name,
      email,
    },
    JWT_SECRET!,
    {
      issuer: 'Close Powerlifting',
    },
  );

  const hashedApiKey = await bcrypt.hash(apiKey, parseInt(PASSWORD_SALT!));

  await User.findOneAndUpdate(
    {
      email,
    },
    {
      $set: {
        key: hashedApiKey,
        password: hashedPassword,
      },
    },
    {
      returnOriginal: false,
    },
  );

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'New API Key and Admin Password for Close Powerlifting',
    html: adminNewAPIKeyHTML({ name, password, apiKey }),
  });

  logger.info(`**** admin user: ${email} has been updated! ****`);
}

type VerificationEmailPrams = {
  hostname: string;
  userId: string;
  name: string;
  email: string;
  verification_token: string;
};

export async function sendVerificationEmail({
  hostname,
  email,
  name,
  verification_token,
  userId,
}: VerificationEmailPrams): Promise<void> {
  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'Account verification',
    html: verifyEmailHTML({
      name,
      hostname,
      email,
      verification_token,
    }),
  });

  logger.info(`Verification email was sent to user_id: ${userId}!`);
}
