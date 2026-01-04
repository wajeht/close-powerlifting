import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request } from "express";
import jwt from "jsonwebtoken";

import { configuration } from "../configuration";
import type { UserParams } from "../types";

export interface HelpersType {
  getHostName: (req: Request) => string;
  hashKey: () => Promise<{ key: string; hashedKey: string }>;
  generateAPIKey: (
    userParams: UserParams & { admin?: boolean },
  ) => Promise<{ unhashedKey: string; hashedKey: string }>;
  timingSafeEqual: (a: string, b: string) => boolean;
  getGoogleOAuthURL: () => string;
  extractNameFromEmail: (email: string) => string;
}

export function createHelper(): HelpersType {
  function getHostName(req: Request): string {
    if (configuration.app.env === "development") {
      const protocol = req.protocol;
      const hostname = req.get("host");
      return `${protocol}://${hostname}`;
    }
    return configuration.app.domain;
  }

  async function hashKey(): Promise<{ key: string; hashedKey: string }> {
    const key = crypto.randomUUID();
    const hashedKey = await bcrypt.hash(key, 5);
    return { key, hashedKey };
  }

  async function generateAPIKey(
    userParams: UserParams & { admin?: boolean },
  ): Promise<{ unhashedKey: string; hashedKey: string }> {
    const { userId, name, email, admin } = userParams;

    const keyOptions = {
      id: userId,
      name,
      email,
      apiKeyVersion: 1,
      issuer: "Close Powerlifting",
    };

    const salt = parseInt(configuration.app.passwordSalt, 10);

    if (admin) {
      const key = jwt.sign(keyOptions, configuration.app.jwtSecret);
      return {
        unhashedKey: key,
        hashedKey: await bcrypt.hash(key, salt),
      };
    }

    const key = jwt.sign(keyOptions, configuration.app.jwtSecret, { expiresIn: "3m" });
    return {
      unhashedKey: key,
      hashedKey: await bcrypt.hash(key, salt),
    };
  }

  function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  function getGoogleOAuthURL(): string {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

    const options = {
      redirect_uri: configuration.oauth.google.redirectUrl,
      client_id: configuration.oauth.google.clientId,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    };

    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  function extractNameFromEmail(email: string): string {
    const username = email.split("@")[0] ?? email;
    // Replace dots, underscores, hyphens with spaces and capitalize each word
    return username
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return {
    getHostName,
    hashKey,
    generateAPIKey,
    timingSafeEqual,
    getGoogleOAuthURL,
    extractNameFromEmail,
  };
}
