import { writeFileSync } from "fs";
import { join } from "path";

import { configuration } from "../src/configuration";
import { createLogger } from "../src/utils/logger";

const logger = createLogger();

const FIXTURES_BASE = join(__dirname, "../src/routes/api");

interface FixtureConfig {
  url: string;
  path: string;
  headers?: Record<string, string>;
}

const fixtures: FixtureConfig[] = [
  // Rankings (JSON API) - Default
  {
    url: "/api/rankings?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-default.json",
  },
  {
    url: "/api/rankings/raw/men?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-raw-men.json",
  },
  {
    url: "/api/rankings/raw/women/75?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-raw-women-75.json",
  },
  {
    url: "/api/rankings/wraps/men/90/2024/full-power/by-dots?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-full-filter.json",
  },

  // Rankings (JSON API) - Units (kg)
  {
    url: "/api/rankings?start=0&end=10&lang=en&units=kg",
    path: "rankings/fixtures/rankings-default-kg.json",
  },

  // Rankings (JSON API) - Federation filter
  {
    url: "/api/rankings/uspa/raw/men?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-uspa-raw-men.json",
  },

  // Rankings (JSON API) - Age class filter
  {
    url: "/api/rankings/raw/men/90/40-44?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-raw-men-90-age40-44.json",
  },

  // Rankings (JSON API) - Sort options
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-wilks?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-wilks.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-glossbrenner?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-glossbrenner.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-goodlift?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-goodlift.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-mcculloch?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-mcculloch.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-total?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-total.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-squat?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-squat.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-bench?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-bench.json",
  },
  {
    url: "/api/rankings/raw/men/90/2024/full-power/by-deadlift?start=0&end=10&lang=en&units=lbs",
    path: "rankings/fixtures/rankings-by-deadlift.json",
  },

  // Records (HTML) - Equipment types
  { url: "/records", path: "records/fixtures/records-default.html" },
  { url: "/records/raw", path: "records/fixtures/records-raw.html" },
  { url: "/records/wraps", path: "records/fixtures/records-wraps.html" },
  { url: "/records/single", path: "records/fixtures/records-single.html" },
  { url: "/records/multi", path: "records/fixtures/records-multi.html" },
  { url: "/records/unlimited", path: "records/fixtures/records-unlimited.html" },
  { url: "/records/all-tested", path: "records/fixtures/records-all-tested.html" },

  // Records (HTML) - Equipment + Sex
  { url: "/records/raw/men", path: "records/fixtures/records-raw-men.html" },
  { url: "/records/raw/women", path: "records/fixtures/records-raw-women.html" },

  // Records (HTML) - Equipment + Weight Class
  {
    url: "/records/unlimited/wp-classes",
    path: "records/fixtures/records-unlimited-wp-classes.html",
  },
  { url: "/records/raw/ipf-classes", path: "records/fixtures/records-raw-ipf-classes.html" },
  {
    url: "/records/raw/expanded-classes",
    path: "records/fixtures/records-raw-expanded-classes.html",
  },

  // Records (HTML) - Equipment + Weight Class + Sex
  {
    url: "/records/unlimited/wp-classes/women",
    path: "records/fixtures/records-unlimited-wp-classes-women.html",
  },
  {
    url: "/records/raw/ipf-classes/men",
    path: "records/fixtures/records-raw-ipf-classes-men.html",
  },

  // Meets (HTML)
  { url: "/m/rps/2548", path: "meets/fixtures/meet-rps-2548.html" },
  { url: "/m/usapl/ISR-2025-02", path: "meets/fixtures/meet-usapl-isr-2025-02.html" },
  { url: "/m/wrpf-usa/23e1", path: "meets/fixtures/meet-wrpf-usa-23e1.html" },
  {
    url: "/m/uspa/1969",
    path: "meets/fixtures/meet-uspa-1969.html",
    headers: { Cookie: "units=lbs;" },
  },
  { url: "/m/uspa/1969/by-wilks", path: "meets/fixtures/meet-uspa-1969-by-wilks.html" },
  { url: "/m/uspa/1969/by-wilks2020", path: "meets/fixtures/meet-uspa-1969-by-wilks2020.html" },
  {
    url: "/m/uspa/1969/by-glossbrenner",
    path: "meets/fixtures/meet-uspa-1969-by-glossbrenner.html",
  },
  { url: "/m/uspa/1969/by-goodlift", path: "meets/fixtures/meet-uspa-1969-by-goodlift.html" },
  { url: "/m/uspa/1969/by-ipf-points", path: "meets/fixtures/meet-uspa-1969-by-ipf-points.html" },
  { url: "/m/uspa/1969/by-mcculloch", path: "meets/fixtures/meet-uspa-1969-by-mcculloch.html" },
  { url: "/m/uspa/1969/by-total", path: "meets/fixtures/meet-uspa-1969-by-total.html" },
  { url: "/m/uspa/1969/by-ah", path: "meets/fixtures/meet-uspa-1969-by-ah.html" },
  { url: "/m/uspa/1969/by-nasa", path: "meets/fixtures/meet-uspa-1969-by-nasa.html" },
  { url: "/m/uspa/1969/by-reshel", path: "meets/fixtures/meet-uspa-1969-by-reshel.html" },
  {
    url: "/m/uspa/1969/by-schwartz-malone",
    path: "meets/fixtures/meet-uspa-1969-by-schwartz-malone.html",
  },
  { url: "/m/uspa/1969/by-division", path: "meets/fixtures/meet-uspa-1969-by-division.html" },
  {
    url: "/m/uspa/1969",
    path: "meets/fixtures/meet-uspa-1969-kg.html",
    headers: { Cookie: "units=kg;" },
  },

  // Users (HTML)
  { url: "/u/kristyhawkins", path: "users/fixtures/user-kristyhawkins.html" },
  {
    url: "/u/johnhaack",
    path: "users/fixtures/user-johnhaack.html",
    headers: { Cookie: "units=lbs;" },
  },
  {
    url: "/u/johnhaack",
    path: "users/fixtures/user-johnhaack-kg.html",
    headers: { Cookie: "units=kg;" },
  },

  // Status (HTML)
  { url: "/status", path: "status/fixtures/status.html" },

  // Federations (HTML)
  { url: "/mlist", path: "federations/fixtures/mlist.html" },
  { url: "/mlist/usapl", path: "federations/fixtures/mlist-usapl.html" },
  { url: "/mlist/usapl/2024", path: "federations/fixtures/mlist-usapl-2024.html" },
];

async function fetchFixture(fixture: FixtureConfig): Promise<void> {
  const url = `${configuration.openpowerlifting.baseUrl}${fixture.url}`;
  const filePath = join(FIXTURES_BASE, fixture.path);

  logger.info(`Fetching: ${url}`);

  const response = await fetch(url, fixture.headers ? { headers: fixture.headers } : undefined);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  writeFileSync(filePath, content, "utf-8");

  logger.info(`Saved to: ${fixture.path}`);
}

async function main(): Promise<void> {
  if (!configuration.openpowerlifting.baseUrl) {
    logger.error("OPENPOWERLIFTING_URL environment variable is required");
    process.exit(1);
  }

  logger.info(`Updating fixtures from ${configuration.openpowerlifting.baseUrl}`);

  const results = await Promise.allSettled(fixtures.map(fetchFixture));

  const failed = results.filter((r) => r.status === "rejected");
  const succeeded = results.filter((r) => r.status === "fulfilled");

  logger.info(`Results: ${succeeded.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    logger.error("Failed fixtures:");
    for (const r of failed) {
      if (r.status === "rejected") {
        logger.error(`  - ${r.reason}`);
      }
    }
    process.exit(1);
  }

  logger.info("All fixtures updated successfully!");
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
