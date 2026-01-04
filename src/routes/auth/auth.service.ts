import bcrypt from "bcryptjs";

import { configuration } from "../../configuration";
import type { UserRepositoryType } from "../../db/user";
import type { HelpersType } from "../../utils/helpers";
import type { MailType } from "../../mail";
import type { User, UserParams, UpdateUserInput } from "../../types";

export interface AuthServiceType {
  updateUser: (email: string, updates: UpdateUserInput) => Promise<User | undefined>;
  resetAPIKey: (userParams: UserParams) => Promise<void>;
  resetAdminAPIKey: (userParams: UserParams) => Promise<void>;
  sendVerificationEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    verification_token: string;
  }) => Promise<void>;
  sendWelcomeEmail: (userParams: UserParams) => Promise<string>;
}

export function createAuthService(
  userRepository: UserRepositoryType,
  helpers: HelpersType,
  mail: MailType,
): AuthServiceType {
  async function updateUser(email: string, updates: UpdateUserInput): Promise<User | undefined> {
    return await userRepository.update(email, updates);
  }

  async function resetAPIKey(userParams: UserParams): Promise<void> {
    const { email } = userParams;
    const { unhashedKey, hashedKey } = await helpers.generateAPIKey(userParams);

    const verified = await updateUser(email, { key: hashedKey });

    await mail.sendNewApiKeyEmail({
      email,
      name: verified!.name!,
      key: unhashedKey,
    });
  }

  async function resetAdminAPIKey(userParams: UserParams): Promise<void> {
    const { name, email } = userParams;
    const password = helpers.generatePassword();
    const hashedPassword = await bcrypt.hash(password, parseInt(configuration.app.passwordSalt));

    const { unhashedKey, hashedKey } = await helpers.generateAPIKey({
      ...userParams,
      admin: true,
    });

    await updateUser(email, {
      key: hashedKey,
      password: hashedPassword,
    });

    await mail.sendAdminCredentialsEmail({
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
    await mail.sendVerificationEmail({
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

    await mail.sendWelcomeEmail({
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
