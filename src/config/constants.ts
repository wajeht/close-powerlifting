import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT as unknown as number;
export const API_URL = process.env.API_URL as unknown as string;
export const BASE_URL = process.env.BASE_URL as unknown as string;
export const SESSION_SECRET = process.env.SESSION_SECRET as unknown as string;
export const COOKIE_EXPIRATION = process.env.COOKIE_EXPIRATION as unknown as number;
export const ENV = process.env.ENV as unknown as string;
export const DOMAIN = process.env.DOMAIN;
export const JWT_SECRET = process.env.JWT_SECRET;
export const EMAIL = {
  HOST: process.env.EMAIL_HOST,
  PORT: process.env.EMAIL_PORT,
  SECURE: process.env.EMAIL_SECURE,
  AUTH_EMAIL: process.env.EMAIL_AUTH_EMAIL,
  AUTH_PASS: process.env.EMAIL_AUTH_PASS,
};
