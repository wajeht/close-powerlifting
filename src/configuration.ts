import dotenv from "dotenv";
import path from "path";

import packageJson from "../package.json";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

export type Env = "production" | "development" | "testing" | "local";

const env = (process.env.APP_ENV || process.env.NODE_ENV || "development") as Env;
const isProduction = env === "production";

function requireEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value && isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || defaultValue || "";
}

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

const openpowerliftingUrl = normalizeUrl(process.env.OPENPOWERLIFTING_URL || "");

export const configuration = {
  app: {
    port: parseInt(process.env.APP_PORT || "80", 10),
    env,
    version: packageJson.version,
    domain: process.env.APP_DOMAIN || "localhost",
    jwtSecret: requireEnv("APP_JWT_SECRET", isProduction ? undefined : "dev-secret-change-me"),
    passwordSalt: process.env.APP_PASSWORD_SALT || "10",
    adminEmail: process.env.APP_ADMIN_EMAIL || "",
    defaultApiCallLimit: 500,
  } as const,

  pagination: {
    defaultPerPage: 100,
    maxPerPage: 500,
  } as const,

  session: {
    name: process.env.SESSION_NAME || "close-powerlifting",
    secret: requireEnv("SESSION_SECRET", isProduction ? undefined : "dev-session-secret-change-me"),
    domain: process.env.SESSION_DOMAIN || "localhost",
  } as const,

  email: {
    host: process.env.EMAIL_HOST || "localhost",
    port: parseInt(process.env.EMAIL_PORT || "1025", 10),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "noreply@closepowerlifting.com",
  } as const,

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUrl: process.env.GOOGLE_OAUTH_REDIRECT_URL || "",
    },
  } as const,

  openpowerlifting: {
    baseUrl: openpowerliftingUrl,
    apiUrl: `${openpowerliftingUrl}/api`,
  } as const,

  cloudflare: {
    turnstileSiteKey: process.env.CLOUDFLARE_TURNSTILE_SITE_KEY || "",
    turnstileSecretKey: process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "",
  } as const,
} as const;
