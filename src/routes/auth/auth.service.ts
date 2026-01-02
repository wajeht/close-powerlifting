import bcrypt from "bcryptjs";

import { config } from "../../config";
import { update } from "../../db/repositories/user.repository";
import type { UserParams } from "../../types";
import { generateAPIKey, generatePassword } from "../../utils/helpers";
import { mailService } from "../../mail";

export async function updateUser(email: string, updates: any): Promise<any> {
  return await update(email, updates);
}

export async function resetAPIKey(userParams: UserParams): Promise<void> {
  const { email } = userParams;
  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, { key: hashedKey });

  await mailService.sendNewApiKeyEmail({
    email,
    name: verified!.name!,
    key: unhashedKey,
  });
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

  await mailService.sendAdminCredentialsEmail({
    email,
    name,
    password,
    apiKey: unhashedKey,
  });
}

export async function sendVerificationEmail({
  hostname,
  email,
  name,
  verification_token,
}: {
  hostname: string;
  email: string;
  name: string;
  verification_token: string;
}) {
  await mailService.sendVerificationEmail({
    hostname,
    email,
    name,
    verification_token,
  });
}

export async function sendWelcomeEmail(userParams: UserParams) {
  const { email } = userParams;

  const { unhashedKey, hashedKey } = await generateAPIKey(userParams);

  const verified = await updateUser(email, {
    key: hashedKey,
    verified: true,
    verified_at: new Date().toISOString(),
  });

  await mailService.sendWelcomeEmail({
    email,
    name: verified!.name!,
    key: unhashedKey,
  });

  return unhashedKey;
}
