import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

// Equipment types
export const recordsDefaultHtml = readFileSync(join(fixturesDir, "records-default.html"), "utf-8");
export const recordsRawHtml = readFileSync(join(fixturesDir, "records-raw.html"), "utf-8");
export const recordsWrapsHtml = readFileSync(join(fixturesDir, "records-wraps.html"), "utf-8");
export const recordsSingleHtml = readFileSync(join(fixturesDir, "records-single.html"), "utf-8");
export const recordsMultiHtml = readFileSync(join(fixturesDir, "records-multi.html"), "utf-8");
export const recordsUnlimitedHtml = readFileSync(join(fixturesDir, "records-unlimited.html"), "utf-8");
export const recordsAllTestedHtml = readFileSync(join(fixturesDir, "records-all-tested.html"), "utf-8");

// Equipment + Sex
export const recordsRawMenHtml = readFileSync(join(fixturesDir, "records-raw-men.html"), "utf-8");
export const recordsRawWomenHtml = readFileSync(join(fixturesDir, "records-raw-women.html"), "utf-8");

// Equipment + Weight Class
export const recordsUnlimitedWpClassesHtml = readFileSync(
  join(fixturesDir, "records-unlimited-wp-classes.html"),
  "utf-8",
);
export const recordsRawIpfClassesHtml = readFileSync(
  join(fixturesDir, "records-raw-ipf-classes.html"),
  "utf-8",
);
export const recordsRawExpandedClassesHtml = readFileSync(
  join(fixturesDir, "records-raw-expanded-classes.html"),
  "utf-8",
);

// Equipment + Weight Class + Sex
export const recordsUnlimitedWpClassesWomenHtml = readFileSync(
  join(fixturesDir, "records-unlimited-wp-classes-women.html"),
  "utf-8",
);
export const recordsRawIpfClassesMenHtml = readFileSync(
  join(fixturesDir, "records-raw-ipf-classes-men.html"),
  "utf-8",
);
