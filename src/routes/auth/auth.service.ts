import crypto from "crypto";
import jwt, { JwtPayload } from "jsonwebtoken";

import { configuration } from "../../configuration";
import type { UserRepositoryType } from "../../db/user";
import { NotFoundError } from "../../error";
import type { MailType } from "../../mail";
import type { User, UserParams, UpdateUserInput } from "../../types";
import type { LoggerType } from "../../utils/logger";

export interface GenerateKeyParams {
  userId: string;
  name: string;
  email: string;
  apiKeyVersion: number;
  admin?: boolean;
}

export interface ValidatedUser {
  id: number;
  name: string;
  email: string;
}

export interface GoogleOAuthToken {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  scope: string;
}

export interface GoogleUserResult {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface AuthServiceType {
  generateKey: (params: GenerateKeyParams) => string;
  validateKey: (token: string) => Promise<ValidatedUser | null>;
  regenerateKey: (userId: number) => Promise<string>;
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
  generateOAuthState: () => string;
  getGoogleOAuthURL: (state: string) => string;
  getGoogleOAuthToken: (params: { code: string }) => Promise<GoogleOAuthToken>;
  getGoogleUser: (params: { id_token: string; access_token: string }) => Promise<GoogleUserResult>;
}

export function createAuthService(
  userRepository: UserRepositoryType,
  mail: MailType,
  logger: LoggerType,
): AuthServiceType {
  function generateKey(params: GenerateKeyParams): string {
    const { userId, name, email, admin, apiKeyVersion } = params;

    const keyOptions = {
      id: userId,
      name,
      email,
      apiKeyVersion,
      issuer: "Close Powerlifting",
    };

    if (admin) {
      return jwt.sign(keyOptions, configuration.app.jwtSecret, {
        algorithm: "HS256",
        expiresIn: "1y",
      });
    }

    return jwt.sign(keyOptions, configuration.app.jwtSecret, {
      algorithm: "HS256",
      expiresIn: "90d",
    });
  }

  async function validateKey(token: string): Promise<ValidatedUser | null> {
    try {
      const decoded = jwt.verify(token, configuration.app.jwtSecret, {
        algorithms: ["HS256"],
      }) as JwtPayload;

      const user = await userRepository.findById(decoded.id);
      if (!user) {
        return null;
      }

      const tokenVersion = decoded.apiKeyVersion ?? 1;
      if (tokenVersion !== user.api_key_version) {
        return null;
      }

      return { id: user.id, name: user.name, email: user.email };
    } catch {
      return null;
    }
  }

  async function regenerateKey(userId: number): Promise<string> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const newVersion = (user.api_key_version || 0) + 1;

    const apiKey = generateKey({
      userId: String(user.id),
      name: user.name,
      email: user.email,
      apiKeyVersion: newVersion,
    });

    await userRepository.updateById(userId, {
      api_key_version: newVersion,
      api_key: apiKey,
    });

    await mail.sendWelcomeEmail({
      email: user.email,
      name: user.name,
      key: apiKey,
    });

    logger.info(`User ${userId} (${user.email}) regenerated API key`);

    return apiKey;
  }

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

    const apiKey = generateKey(userParams);

    const verified = await updateUser(email, {
      api_key: apiKey,
      verified: true,
      verified_at: new Date().toISOString(),
    });

    await mail.sendWelcomeEmail({
      email,
      name: verified!.name!,
      key: apiKey,
    });

    return apiKey;
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

  function generateOAuthState(): string {
    return crypto.randomUUID();
  }

  function getGoogleOAuthURL(state: string): string {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

    const options = {
      redirect_uri: configuration.oauth.google.redirectUrl,
      client_id: configuration.oauth.google.clientId,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      state,
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  async function getGoogleOAuthToken({ code }: { code: string }): Promise<GoogleOAuthToken> {
    const url = "https://oauth2.googleapis.com/token";

    const params = new URLSearchParams({
      code,
      client_id: configuration.oauth.google.clientId,
      client_secret: configuration.oauth.google.clientSecret,
      redirect_uri: configuration.oauth.google.redirectUrl,
      grant_type: "authorization_code",
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch Google OAuth Tokens", { cause: response.statusText });
      }

      return response.json();
    } catch (error: unknown) {
      logger.error("Failed to fetch Google OAuth Tokens", { error });
      throw error;
    }
  }

  async function getGoogleUser({
    id_token,
    access_token,
  }: {
    id_token: string;
    access_token: string;
  }): Promise<GoogleUserResult> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
        {
          headers: {
            Authorization: `Bearer ${id_token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Google User info", { cause: response.statusText });
      }

      return response.json();
    } catch (error: unknown) {
      logger.error("Failed to fetch Google User info");
      throw error;
    }
  }

  return {
    generateKey,
    validateKey,
    regenerateKey,
    updateUser,
    sendVerificationEmail,
    sendMagicLinkEmail,
    sendWelcomeEmail,
    generateOAuthState,
    getGoogleOAuthURL,
    getGoogleOAuthToken,
    getGoogleUser,
  };
}
