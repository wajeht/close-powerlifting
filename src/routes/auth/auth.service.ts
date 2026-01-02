import bcrypt from "bcryptjs";

import { config } from "../../config";
import { User } from "../../db/user";
import type { UserParams } from "../../types";
import { Helpers } from "../../utils/helpers";
import { MailService } from "../../mail";

export function AuthService() {
  const userRepository = User();
  const helpers = Helpers();
  const mailService = MailService();

  async function updateUser(email: string, updates: any): Promise<any> {
    return await userRepository.update(email, updates);
  }

  async function resetAPIKey(userParams: UserParams): Promise<void> {
    const { email } = userParams;
    const { unhashedKey, hashedKey } = await helpers.generateAPIKey(userParams);

    const verified = await updateUser(email, { key: hashedKey });

    await mailService.sendNewApiKeyEmail({
      email,
      name: verified!.name!,
      key: unhashedKey,
    });
  }

  async function resetAdminAPIKey(userParams: UserParams): Promise<void> {
    const { name, email } = userParams;
    const password = helpers.generatePassword();
    const hashedPassword = await bcrypt.hash(password, parseInt(config.app.passwordSalt));

    const { unhashedKey, hashedKey } = await helpers.generateAPIKey({ ...userParams, admin: true });

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

  async function sendVerificationEmail({
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

  async function sendWelcomeEmail(userParams: UserParams) {
    const { email } = userParams;

    const { unhashedKey, hashedKey } = await helpers.generateAPIKey(userParams);

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

  return {
    updateUser,
    resetAPIKey,
    resetAdminAPIKey,
    sendVerificationEmail,
    sendWelcomeEmail,
  };
}
