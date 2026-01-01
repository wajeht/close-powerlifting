import bcrypt from "bcryptjs";

import { config } from "../../config";
import * as UserRepository from "../../db/repositories/user.repository";
import { generateAPIKey, generatePassword } from "../../utils/helpers";
import logger from "../../utils/logger";
import mail from "../../utils/mail";
import adminNewAPIKeyHTML from "../../utils/templates/admin-new-api-key";
import newAPIKeyHTML from "../../utils/templates/new-api-key";
import verifyEmailHTML from "../../utils/templates/verify-email";
import welcomeHTML from "../../utils/templates/welcome";

export type UserParams = {
  userId: string;
  name: string;
  email: string;
};

type VerificationEmailParams = {
  hostname: string;
  userId: string;
  name: string;
  email: string;
  verification_token: string;
};

export async function updateUser(email: string, updates: any): Promise<any> {
  return await UserRepository.update(email, updates);
}

export async function resetAPIKey(userParams: UserParams): Promise<void> {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, { key: hashedKey });

  mail.sendMail({
    from: `"Close Powerlifting" <${config.email.user}>`,
    to: email,
    subject: "New API key for Close Powerlifting",
    html: newAPIKeyHTML({ name: verified!.name!, key: unhashedKey }),
  });

  logger.info(`Reset API email was sent to email: ${email}!`);
}

export async function resetAdminAPIKey(userParams: UserParams): Promise<void> {
  const { name, email } = userParams;
  const password = generatePassword();
  const hashedPassword = await bcrypt.hash(password, parseInt(config.app.passwordSalt));

  const { unhashedKey, hashedKey } = await generateAPIKey({ ...userParams, admin: true });

  await updateUser(email, {
    key: hashedKey,
    password: hashedPassword,
  });

  mail.sendMail({
    from: `"Close Powerlifting" <${config.email.user}>`,
    to: email,
    subject: "New API Key and Admin Password for Close Powerlifting",
    html: adminNewAPIKeyHTML({ name, password, apiKey: unhashedKey }),
  });

  logger.info(`admin user: ${email} has been updated!`);
}

export async function sendVerificationEmail({
  hostname,
  email,
  name,
  verification_token,
  userId,
}: VerificationEmailParams) {
  await mail.sendMail({
    from: `"Close Powerlifting" <${config.email.user}>`,
    to: email,
    subject: "Account verification",
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

  const verified = await updateUser(email, {
    key: hashedKey,
    verified: true,
    verified_at: new Date().toISOString(),
  });

  mail.sendMail({
    from: `"Close Powerlifting" <${config.email.user}>`,
    to: email,
    subject: "API Key for Close Powerlifting",
    html: welcomeHTML({ name: verified!.name!, key: unhashedKey }),
  });

  logger.info(`user_id: ${verified!.id} has verified email!`);

  return unhashedKey;
}
