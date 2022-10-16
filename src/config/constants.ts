import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT;
export const API_URL = process.env.API_URL;
export const BASE_URL = process.env.BASE_URL;
export const ENV = process.env.ENV;
