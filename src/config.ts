import dotenv from "dotenv";
import path from "path";

import packageJson from "../package.json";

dotenv.config({ path: path.resolve(path.join(process.cwd(), ".env")) });

export type Env = "production" | "development" | "testing" | "local";

export const config = {
  app: {
    port: parseInt(process.env.APP_PORT || "80", 10),
    env: (process.env.APP_ENV || process.env.NODE_ENV || "development") as Env,
    version: packageJson.version,
    domain: process.env.APP_DOMAIN || "localhost",
    apiUrl: process.env.API_URL || "",
    baseUrl: process.env.BASE_URL || "",
    jwtSecret: process.env.APP_JWT_SECRET || "secret",
    passwordSalt: process.env.APP_PASSWORD_SALT || "5",
    adminEmail: process.env.APP_ADMIN_EMAIL || "",
    adminName: process.env.APP_ADMIN_NAME || "",
    xApiKey: process.env.X_API_KEY || "",
    defaultApiCallLimit: 500,
  } as const,

  session: {
    name: process.env.SESSION_NAME || "close-powerlifting",
    secret: process.env.SESSION_SECRET || "secret",
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
    password: process.env.COOKIE_PASSWORD || "password",
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
