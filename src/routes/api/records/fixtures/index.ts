import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const recordsDefaultHtml = readFileSync(join(fixturesDir, "records-default.html"), "utf-8");
export const recordsRawHtml = readFileSync(join(fixturesDir, "records-raw.html"), "utf-8");
export const recordsRawMenHtml = readFileSync(join(fixturesDir, "records-raw-men.html"), "utf-8");
