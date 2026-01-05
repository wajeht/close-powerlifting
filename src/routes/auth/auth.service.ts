import type { UserRepositoryType } from "../../db/user";
import type { HelpersType } from "../../utils/helpers";
import type { MailType } from "../../mail";
import type { User, UserParams, UpdateUserInput } from "../../types";

export interface AuthServiceType {
  updateUser: (email: string, updates: UpdateUserInput) => Promise<User | undefined>;
  sendVerificationEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    verification_token: string;
  }) => Promise<void>;
  sendMagicLinkEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    token: string;
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
      api_key: hashedKey,
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

  async function sendMagicLinkEmail({
    hostname,
    email,
    name,
    token,
  }: {
    hostname: string;
    email: string;
    name: string;
    token: string;
  }) {
    await mail.sendMagicLinkEmail({
      hostname,
      email,
      name,
      token,
    });
  }

  return {
    updateUser,
    sendVerificationEmail,
    sendMagicLinkEmail,
    sendWelcomeEmail,
  };
}
