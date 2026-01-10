import crypto from "crypto";
import { Request } from "express";

import { configuration } from "../configuration";
import type { Pagination, TurnstileVerifyResponse } from "../types";

export function buildPagination(total: number, page: number, limit: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * limit;

  return {
    items: total,
    pages: totalPages,
    per_page: limit,
    current_page: currentPage,
    last_page: totalPages,
    first_page: 1,
    from: total > 0 ? offset + 1 : 0,
    to: Math.min(offset + limit, total),
  };
}

export interface HelpersType {
  getHostName: (req: Request) => string;
  generateToken: () => string;
  timingSafeEqual: (a: string, b: string) => boolean;
  extractNameFromEmail: (email: string) => string;
  verifyTurnstileToken: (token: string, remoteip?: string) => Promise<TurnstileVerifyResponse>;
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

  async function verifyTurnstileToken(
    token: string,
    remoteip?: string,
  ): Promise<TurnstileVerifyResponse> {
    const formData = new URLSearchParams();
    formData.append("secret", configuration.cloudflare.turnstileSecretKey);
    formData.append("response", token);
    if (remoteip) {
      formData.append("remoteip", remoteip);
    }

    try {
      const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`Turnstile API returned ${result.status}: ${result.statusText}`);
      }

      const outcome = (await result.json()) as TurnstileVerifyResponse;

      if (!outcome.success) {
        const errors = outcome["error-codes"]?.join(", ") || "Unknown error";
        throw new Error(`Turnstile validation failed: ${errors}`);
      }

      return outcome;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to verify Turnstile token: ${error.message}`);
      }
      throw new Error("Failed to verify Turnstile token: Unknown error");
    }
  }

  return {
    getHostName,
    generateToken,
    timingSafeEqual,
    extractNameFromEmail,
    verifyTurnstileToken,
  };
}
