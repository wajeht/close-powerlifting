import { writeFileSync } from "fs";
import { join } from "path";

import { configuration } from "../src/configuration";
import { createLogger } from "../src/utils/logger";

const logger = createLogger();

const FIXTURES_BASE = join(__dirname, "../src/routes/api");

interface FixtureConfig {
  url: string;
  path: string;
}

const fixtures: FixtureConfig[] = [
  // Rankings (JSON API)
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

  // Records (HTML)
  { url: "/records", path: "records/fixtures/records-default.html" },
  { url: "/records/raw", path: "records/fixtures/records-raw.html" },
  { url: "/records/raw/men", path: "records/fixtures/records-raw-men.html" },

  // Meets (HTML)
  { url: "/m/rps/2548", path: "meets/fixtures/meet-rps-2548.html" },
  { url: "/m/usapl/ISR-2025-02", path: "meets/fixtures/meet-usapl-isr-2025-02.html" },
  { url: "/m/wrpf-usa/23e1", path: "meets/fixtures/meet-wrpf-usa-23e1.html" },
  { url: "/m/uspa/1969", path: "meets/fixtures/meet-uspa-1969.html" },

  // Users (HTML)
  { url: "/u/kristyhawkins", path: "users/fixtures/user-kristyhawkins.html" },
  { url: "/u/johnhaack", path: "users/fixtures/user-johnhaack.html" },

  // Status (HTML)
  { url: "/status", path: "status/fixtures/status.html" },

  // Federations (HTML)
  { url: "/mlist", path: "federations/fixtures/mlist.html" },
  { url: "/mlist/usapl", path: "federations/fixtures/mlist-usapl.html" },
  { url: "/mlist/usapl/2024", path: "federations/fixtures/mlist-usapl-2024.html" },
];

async function fetchFixture(fixture: FixtureConfig): Promise<void> {
  const baseUrl = configuration.app.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}${fixture.url}`;
  const filePath = join(FIXTURES_BASE, fixture.path);

  logger.info(`Fetching: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  writeFileSync(filePath, content, "utf-8");

  logger.info(`Saved to: ${fixture.path}`);
}

async function main(): Promise<void> {
  if (!configuration.app.baseUrl) {
    logger.error("BASE_URL environment variable is required");
    process.exit(1);
  }

  logger.info(`Updating fixtures from ${configuration.app.baseUrl}`);

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
