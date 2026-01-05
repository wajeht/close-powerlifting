import crypto from "crypto";
import { Request } from "express";
import jwt from "jsonwebtoken";

import { configuration } from "../configuration";
import type { UserParams } from "../types";

export interface HelpersType {
  getHostName: (req: Request) => string;
  generateToken: () => string;
  generateAPIKey: (userParams: UserParams & { admin?: boolean }) => string;
  timingSafeEqual: (a: string, b: string) => boolean;
  getGoogleOAuthURL: (state: string) => string;
  generateOAuthState: () => string;
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

  function generateToken(): string {
    return crypto.randomUUID();
  }

  function generateAPIKey(userParams: UserParams & { admin?: boolean }): string {
    const { userId, name, email, admin } = userParams;

    const keyOptions = {
      id: userId,
      name,
      email,
      apiKeyVersion: 1,
      issuer: "Close Powerlifting",
    };

    if (admin) {
      return jwt.sign(keyOptions, configuration.app.jwtSecret, { expiresIn: "1y" });
    }

    return jwt.sign(keyOptions, configuration.app.jwtSecret, { expiresIn: "90d" });
  }

  function timingSafeEqual(a: string, b: string): boolean {
    const aHash = crypto.createHash("sha256").update(a).digest();
    const bHash = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(aHash, bHash);
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
    generateToken,
    generateAPIKey,
    timingSafeEqual,
    generateOAuthState,
    getGoogleOAuthURL,
    extractNameFromEmail,
  };
}
