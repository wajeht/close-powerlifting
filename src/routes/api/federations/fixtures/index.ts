import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const mlistHtml = readFileSync(join(fixturesDir, "mlist.html"), "utf-8");
export const mlistUsaplHtml = readFileSync(join(fixturesDir, "mlist-usapl.html"), "utf-8");
export const mlistUsapl2024Html = readFileSync(join(fixturesDir, "mlist-usapl-2024.html"), "utf-8");
