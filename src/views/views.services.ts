import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

import { EMAIL, PASSWORD_SALT } from '../config/constants';
import { generateAPIKey } from '../utils/helpers';
import logger from '../utils/logger';
import mail from '../utils/mail';
import redis from '../utils/redis';
import adminNewAPIKeyHTML from '../utils/templates/admin-new-api-key';
import newAPIKeyHTML from '../utils/templates/new-api-key';
import verifyEmailHTML from '../utils/templates/verify-email';
import welcomeHTML from '../utils/templates/welcome';
import { User } from './views.models';

export type UserParams = {
  userId: string;
  name: string;
  email: string;
};

type VerificationEmailPrams = {
  hostname: string;
  userId: string;
  name: string;
  email: string;
  verification_token: string;
};

export async function updateUser(email: string, updates: any): Promise<any> {
  return await User.findOneAndUpdate({ email }, { $set: updates }, { returnOriginal: false });
}

export async function resetAPIKey(userParams: UserParams): Promise<void> {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, { key: hashedKey });

  mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'New API key for Close Powerlifting',
    html: newAPIKeyHTML({ name: verified!.name!, key: unhashedKey }),
  });

  logger.info(`Reset API email was sent to email: ${email}!`);
}

export async function resetAdminAPIKey(userParams: UserParams): Promise<void> {
  const { name, email } = userParams;
  const password = faker.internet.password(50);
  const hashedPassword = await bcrypt.hash(password, parseInt(PASSWORD_SALT!));

  const { unhashedKey, hashedKey } = await generateAPIKey({ ...userParams, admin: true });

  await updateUser(email, {
    key: hashedKey,
    password: hashedPassword,
  });

  mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'New API Key and Admin Password for Close Powerlifting',
    html: adminNewAPIKeyHTML({ name, password, apiKey: unhashedKey }),
  });

  logger.info(`**** admin user: ${email} has been updated! ****`);
}

export function sendVerificationEmail({
  hostname,
  email,
  name,
  verification_token,
  userId,
}: VerificationEmailPrams) {
  mail.sendMail({
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

export async function sendWelcomeEmail(userParams: UserParams) {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  let verified = await updateUser(email, {
    key: hashedKey,
    verified: true,
    verified_at: new Date().toISOString(),
  });

  mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'API Key for Close Powerlifting',
    html: welcomeHTML({ name: verified!.name!, key: unhashedKey }),
  });

  logger.info(`user_id: ${verified!.id} has verified email!`);

  return unhashedKey;
}
