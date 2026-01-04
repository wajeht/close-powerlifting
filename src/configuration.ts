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

export const configuration = {
  app: {
    port: parseInt(process.env.APP_PORT || "80", 10),
    env,
    version: packageJson.version,
    domain: process.env.APP_DOMAIN || "localhost",
    apiUrl: process.env.API_URL || "",
    baseUrl: process.env.BASE_URL || "",
    jwtSecret: requireEnv("APP_JWT_SECRET", isProduction ? undefined : "dev-secret-change-me"),
    passwordSalt: process.env.APP_PASSWORD_SALT || "10",
    adminEmail: process.env.APP_ADMIN_EMAIL || "",
    adminName: process.env.APP_ADMIN_NAME || "",
    xApiKey: process.env.X_API_KEY || "",
    defaultApiCallLimit: 500,
  } as const,

  pagination: {
    defaultPerPage: 100,
    maxPerPage: 500,
  } as const,

  session: {
    name: process.env.SESSION_NAME || "close-powerlifting",
    secret: requireEnv("SESSION_SECRET", isProduction ? undefined : "dev-session-secret-change-me"),
  } as const,

  email: {
    host: process.env.EMAIL_HOST || "localhost",
    port: parseInt(process.env.EMAIL_PORT || "1025", 10),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "noreply@close-powerlifting.local",
  } as const,

  cookie: {
    expiration: parseInt(process.env.COOKIE_EXPIRATION || "60000", 10),
    password: requireEnv(
      "COOKIE_PASSWORD",
      isProduction ? undefined : "dev-cookie-password-change-me",
    ),
    name: process.env.COOKIE_NAME || "close-powerlifting",
  } as const,

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUrl: process.env.GOOGLE_OAUTH_REDIRECT_URL || "",
    },
  } as const,
} as const;
