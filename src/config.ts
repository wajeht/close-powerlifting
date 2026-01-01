import dotenv from "dotenv";
import path from "path";

import packageJson from "../package.json";

dotenv.config({ path: path.resolve(path.join(process.cwd(), ".env")) });

export type Env = "production" | "development" | "testing" | "local";

export const config = {
  app: {
    port: parseInt(process.env.PORT || "80", 10),
    env: (process.env.ENV || process.env.NODE_ENV || "development") as Env,
    version: packageJson.version,
    domain: process.env.DOMAIN || "localhost",
    frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:8080",
    apiUrl: process.env.API_URL || "https://www.openpowerlifting.org/api",
    baseUrl: process.env.BASE_URL || "https://www.openpowerlifting.org/",
    jwtSecret: process.env.JWT_SECRET || "secret",
    passwordSalt: process.env.PASSWORD_SALT || "5",
    adminEmail: process.env.ADMIN_EMAIL || "",
    adminName: process.env.ADMIN_NAME || "",
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
    user: process.env.EMAIL_AUTH_EMAIL || "",
    password: process.env.EMAIL_AUTH_PASS || "",
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
