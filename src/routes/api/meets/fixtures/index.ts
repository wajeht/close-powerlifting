import { readFileSync, existsSync } from "fs";
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
export const meetUspa1969Html = readFileSync(join(fixturesDir, "meet-uspa-1969.html"), "utf-8");

const byWilksPath = join(fixturesDir, "meet-uspa-1969-by-wilks.html");
const byTotalPath = join(fixturesDir, "meet-uspa-1969-by-total.html");

export const meetUspa1969ByWilksHtml = existsSync(byWilksPath)
  ? readFileSync(byWilksPath, "utf-8")
  : undefined;
export const meetUspa1969ByTotalHtml = existsSync(byTotalPath)
  ? readFileSync(byTotalPath, "utf-8")
  : undefined;
