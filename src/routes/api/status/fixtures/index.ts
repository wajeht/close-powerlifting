import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const statusHtml = readFileSync(join(fixturesDir, "status.html"), "utf-8");
