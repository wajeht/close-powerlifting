import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const userKristyHawkinsHtml = readFileSync(
  join(fixturesDir, "user-kristyhawkins.html"),
  "utf-8",
);
export const userJohnHaackHtml = readFileSync(join(fixturesDir, "user-johnhaack.html"), "utf-8");
