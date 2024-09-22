import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const appConfig = {
  frontend_origin: process.env.FRONTEND_ORIGIN as unknown as string,
  port: process.env.PORT as unknown as number,
  api_url: process.env.API_URL as unknown as string,
  base_url: process.env.BASE_URL as unknown as string,
  env: process.env.ENV as 'production' | 'development' | 'testing' | 'local',
  domain: process.env.DOMAIN,
  jwt_secret: process.env.JWT_SECRET,
  password_salt: process.env.PASSWORD_SALT,
  mongodb_uri: process.env.MONGODB_URI,
  admin_email: process.env.ADMIN_EMAIL,
  admin_name: process.env.ADMIN_NAME,
  x_api_key: process.env.X_API_KEY,
} as const;

export const sessionConfig = {
  name: process.env.SESSION_NAME as unknown as string,
  secret: process.env.SESSION_SECRET as unknown as string,
} as const;

export const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE,
  auth_email: process.env.EMAIL_AUTH_EMAIL,
  auth_pass: process.env.EMAIL_AUTH_PASS,
} as const;

export const redisConfig = {
  host: process.env.REDIS_HOST as unknown as string,
  port: process.env.REDIS_PORT as unknown as number,
  username: process.env.REDIS_USERNAME as unknown as string,
  password: process.env.REDIS_PASSWORD as unknown as string,
} as const;

export const cookieConfig = {
  expiration: process.env.COOKIE_EXPIRATION as unknown as number,
  password: process.env.COOKIE_PASSWORD as unknown as string,
  name: process.env.COOKIE_NAME as unknown as string,
} as const;

export const oauthConfig = {
  google: {
    client_id: process.env.GOOGLE_CLIENT_ID as unknown as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as unknown as string,
    oauth_redirect_url: process.env.GOOGLE_OAUTH_REDIRECT_URL as unknown as string,
  },
  GITHUB: {
    client_id: process.env.GITHUB_CLIENT_ID as unknown as string,
    client_secret: process.env.GITHUB_CLIENT_SECRET as unknown as string,
    oauth_redirect_url: process.env.GITHUB_OAUTH_REDIRECT_URL as unknown as string,
  },
} as const;
