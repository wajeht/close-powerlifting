import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config";
import type { UserParams } from "../types";

export function getHostName(req: Request): string {
  if (config.app.env === "development") {
    const protocol = req.protocol;
    const hostname = req.get("host");
    return `${protocol}://${hostname}`;
  }
  return config.app.domain;
}

export async function hashKey(): Promise<{ key: string; hashedKey: string }> {
  const key = crypto.randomUUID();
  const hashedKey = await bcrypt.hash(key, 5);
  return { key, hashedKey };
}

export async function generateAPIKey(
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

  const salt = parseInt(config.app.passwordSalt, 10);

  if (admin) {
    const key = jwt.sign(keyOptions, config.app.jwtSecret);
    return {
      unhashedKey: key,
      hashedKey: await bcrypt.hash(key, salt),
    };
  }

  const key = jwt.sign(keyOptions, config.app.jwtSecret, { expiresIn: "3m" });
  return {
    unhashedKey: key,
    hashedKey: await bcrypt.hash(key, salt),
  };
}

export function generatePassword(length = 50): string {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function getGoogleOAuthURL(): string {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: config.oauth.google.redirectUrl,
    client_id: config.oauth.google.clientId,
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
