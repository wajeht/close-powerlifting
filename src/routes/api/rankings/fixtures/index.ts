import { readFileSync, existsSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

function loadFixture(filename: string) {
  const path = join(fixturesDir, filename);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

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

export const rankingsDefaultKg = loadFixture("rankings-default-kg.json");
export const rankingsUspaRawMen = loadFixture("rankings-uspa-raw-men.json");
export const rankingsRawMen90Age4044 = loadFixture("rankings-raw-men-90-age40-44.json");
export const rankingsByGlPoints = loadFixture("rankings-by-gl-points.json");
export const rankingsByMcculloch = loadFixture("rankings-by-mcculloch.json");
