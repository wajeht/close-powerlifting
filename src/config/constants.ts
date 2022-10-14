import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(path.join(process.cwd(), ".env")) });

export const PORT = process.env.PORT;

export const RANKING_URL = process.env.RANKING_URL;
