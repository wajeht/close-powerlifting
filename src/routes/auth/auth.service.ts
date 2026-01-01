import bcrypt from "bcryptjs";

import { config } from "../../config";
import { update } from "../../db/repositories/user.repository";
import type { UserParams } from "../../types";
import { generateAPIKey, generatePassword } from "../../utils/helpers";
import { logger } from "../../utils/logger";
import { mail } from "../../utils/mail";
import { createAdminNewApiKeyText } from "../../utils/templates/admin-new-api-key";
import { createNewApiKeyText } from "../../utils/templates/new-api-key";
import { createVerifyEmailText } from "../../utils/templates/verify-email";
import { createWelcomeText } from "../../utils/templates/welcome";

type VerificationEmailParams = {
  hostname: string;
  userId: string;
  name: string;
  email: string;
  verification_token: string;
};

export async function updateUser(email: string, updates: any): Promise<any> {
  return await update(email, updates);
}

export async function resetAPIKey(userParams: UserParams): Promise<void> {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, { key: hashedKey });

  try {
    await mail.sendMail({
      from: `"Close Powerlifting" <${config.email.from}>`,
      to: email,
      subject: "New API key for Close Powerlifting",
      text: createNewApiKeyText({ name: verified!.name!, key: unhashedKey }),
    });
    logger.info(`Reset API email was sent to email: ${email}!`);
  } catch (error) {
    logger.error(`Failed to send reset API email to ${email}: ${error}`);
  }
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

  try {
    await mail.sendMail({
      from: `"Close Powerlifting" <${config.email.from}>`,
      to: email,
      subject: "New API Key and Admin Password for Close Powerlifting",
      text: createAdminNewApiKeyText({ name, password, apiKey: unhashedKey }),
    });
    logger.info(`admin user: ${email} has been updated!`);
  } catch (error) {
    logger.error(`Failed to send admin reset email to ${email}: ${error}`);
  }
}

export async function sendVerificationEmail({
  hostname,
  email,
  name,
  verification_token,
  userId,
}: VerificationEmailParams) {
  try {
    await mail.sendMail({
      from: `"Close Powerlifting" <${config.email.from}>`,
      to: email,
      subject: "Account verification",
      text: createVerifyEmailText({
        name,
        hostname,
        email,
        verification_token,
      }),
    });
    logger.info(`Verification email was sent to user_id: ${userId}!`);
  } catch (error) {
    logger.error(`Failed to send verification email to ${email}: ${error}`);
  }
}

export async function sendWelcomeEmail(userParams: UserParams) {
  const { email } = userParams;

  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, {
    key: hashedKey,
    verified: true,
    verified_at: new Date().toISOString(),
  });

  try {
    await mail.sendMail({
      from: `"Close Powerlifting" <${config.email.from}>`,
      to: email,
      subject: "API Key for Close Powerlifting",
      text: createWelcomeText({ name: verified!.name!, key: unhashedKey }),
    });
    logger.info(`user_id: ${verified!.id} has verified email!`);
  } catch (error) {
    logger.error(`Failed to send welcome email to ${email}: ${error}`);
  }

  return unhashedKey;
}
