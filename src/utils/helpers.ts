import crypto from "crypto";
import { Request } from "express";

import { configuration } from "../configuration";

export interface HelpersType {
  getHostName: (req: Request) => string;
  generateToken: () => string;
  timingSafeEqual: (a: string, b: string) => boolean;
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

  function timingSafeEqual(a: string, b: string): boolean {
    const aHash = crypto.createHash("sha256").update(a).digest();
    const bHash = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(aHash, bHash);
  }

  function extractNameFromEmail(email: string): string {
    const username = email.split("@")[0] ?? email;
    return username
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return {
    getHostName,
    generateToken,
    timingSafeEqual,
    extractNameFromEmail,
  };
}
