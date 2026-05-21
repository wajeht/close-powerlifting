import fs from "node:fs";
import path from "node:path";

import packageJson from "../package.json";

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

export type Env = "production" | "development" | "testing" | "local";

const env = (process.env.APP_ENV || process.env.NODE_ENV || "development") as Env;

export const configuration = {
  app: {
    port: parseInt(process.env.APP_PORT || "80", 10),
    env,
    version: packageJson.version,
    domain: process.env.APP_DOMAIN || "localhost",
  } as const,

  pagination: {
    defaultPerPage: 100,
    maxPerPage: 500,
  } as const,
} as const;
