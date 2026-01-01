import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const rankingsDefault = JSON.parse(
  readFileSync(join(fixturesDir, "rankings-default.json"), "utf-8"),
);

export const rankingsRawMen = JSON.parse(
  readFileSync(join(fixturesDir, "rankings-raw-men.json"), "utf-8"),
);

export const rankingsRawWomen75 = JSON.parse(
  readFileSync(join(fixturesDir, "rankings-raw-women-75.json"), "utf-8"),
);

export const rankingsFullFilter = JSON.parse(
  readFileSync(join(fixturesDir, "rankings-full-filter.json"), "utf-8"),
);
