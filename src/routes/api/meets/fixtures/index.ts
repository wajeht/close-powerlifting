import { readFileSync } from "fs";
import { join } from "path";

const fixturesDir = __dirname;

export const meetRps2548Html = readFileSync(join(fixturesDir, "meet-rps-2548.html"), "utf-8");
export const meetUsaplIsr2025Html = readFileSync(
  join(fixturesDir, "meet-usapl-isr-2025-02.html"),
  "utf-8",
);
export const meetWrpfUsa23e1Html = readFileSync(
  join(fixturesDir, "meet-wrpf-usa-23e1.html"),
  "utf-8",
);
