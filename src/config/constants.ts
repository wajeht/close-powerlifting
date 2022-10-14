import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT;

export const RANKINGS_URL = process.env.RANKINGS_URL;

export const AXIOS_HOST = process.env.AXIOS_HOST;
