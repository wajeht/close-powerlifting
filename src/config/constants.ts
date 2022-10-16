import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const PORT = process.env.PORT;
export const API = process.env.API;
export const ENV = process.env.ENV;
