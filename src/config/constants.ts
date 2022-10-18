import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT as unknown as number;
export const API_URL = process.env.API_URL as unknown as string;
export const BASE_URL = process.env.BASE_URL as unknown as string;
export const SESSION_SECRET = process.env.COOKIE_SECRET as unknown as string;
export const ENV = process.env.ENV as unknown as string;
