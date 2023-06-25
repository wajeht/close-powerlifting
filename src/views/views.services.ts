import { faker } from '@faker-js/faker';
import axios from 'axios';
import bcrypt from 'bcryptjs';

import { EMAIL, PASSWORD_SALT } from '../config/constants';
import { generateAPIKey } from '../utils/helpers';
import logger from '../utils/logger';
import mail from '../utils/mail';
// @ts-ignore
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

  await mail.sendMail({
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

  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  await updateUser(email, {
    key: hashedKey,
    password: hashedPassword,
  });

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'New API Key and Admin Password for Close Powerlifting',
    html: adminNewAPIKeyHTML({ name, password, apiKey: unhashedKey }),
  });

  logger.info(`**** admin user: ${email} has been updated! ****`);
}

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

export async function sendWelcomeEmail(userParams: UserParams): Promise<void> {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  let verified = await updateUser(email, {
    key: hashedKey,
    verified: true,
    verified_at: new Date().toISOString(),
  });

  await mail.sendMail({
    from: `"Close Powerlifting" <${EMAIL.AUTH_EMAIL}>`,
    to: email,
    subject: 'API Key for Close Powerlifting',
    html: welcomeHTML({ name: verified!.name!, key: unhashedKey }),
  });

  logger.info(`user_id: ${verified!.id} has verified email!`);
}

export async function getAPIStatus({ X_API_KEY, url }: { X_API_KEY: string; url: string }) {
  const fetchStatus = async () => {
    const fetch = axios.create({
      baseURL: url,
      headers: {
        authorization: `Bearer ${X_API_KEY}`,
      },
    });

    const routes = [
      '/api/rankings?cache=false',
      '/api/rankings/1?cache=false',
      '/api/rankings?current_page=1&per_page=100&cache=false',
      '/api/meets?cache=false',
      '/api/meets?current_page=1&per_page=100&cache=false',
      'api/meets/ipf?cache=false',
      'api/meets/ipf?year=2020&cache=false',
      '/api/records?cache=false',
      '/api/users/johnhaack?cache=false',
      '/api/status?cache=false',
      '/api/users?search=haack&cache=false',
    ];

    const promises = await Promise.allSettled(routes.map((r) => fetch(r)));

    const data = promises.map((p) => {
      const fulfilled = p.status === 'fulfilled';
      const config = fulfilled ? p.value?.config : p.reason?.config;
      const headers = fulfilled ? p.value?.headers : p.reason?.response?.headers;

      return {
        status: fulfilled,
        method: config?.method?.toUpperCase(),
        url: config?.url,
        date: headers?.date,
      };
    });

    return data;
  };

  const cacheKey = `close-powerlifting-gloabl-status-call-cache`;

  // @ts-ignore
  let data = JSON.parse(await redis.get(cacheKey));

  if (data === null) {
    data = await fetchStatus();

    // After fetching the data, store it in the Redis cache
    // The 'EX' option sets an expiration time on the cache, in seconds
    // Here we set it to 60 minutes (60 * 60 seconds)
    // @ts-ignore
    await redis.set(cacheKey, JSON.stringify(data), 'EX', 60 * 60);
  }

  return data;
}
