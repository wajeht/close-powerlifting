import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT;
export const BASE_URL = process.env.BASE_URL;
export const ENV = process.env.ENV;
