import { readFileSync, existsSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

function loadFixture(filename: string): string | null {
  const path = join(fixturesDir, filename);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

export const userKristyHawkinsHtml = readFileSync(
  join(fixturesDir, "user-kristyhawkins.html"),
  "utf-8",
);
export const userJohnHaackHtml = readFileSync(join(fixturesDir, "user-johnhaack.html"), "utf-8");
export const userJohnHaackKgHtml = loadFixture("user-johnhaack-kg.html");
