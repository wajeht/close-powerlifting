import { writeFileSync } from "fs";
import { join } from "path";

const BASE_URL = "https://www.openpowerlifting.org";
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

async function fetchFixture(config: FixtureConfig): Promise<void> {
  const url = `${BASE_URL}${config.url}`;
  const filePath = join(FIXTURES_BASE, config.path);

  console.log(`Fetching: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  writeFileSync(filePath, content, "utf-8");

  console.log(`  -> Saved to: ${config.path}`);
}

async function main(): Promise<void> {
  console.log("Updating OpenPowerlifting fixtures...\n");

  const results = await Promise.allSettled(fixtures.map(fetchFixture));

  const failed = results.filter((r) => r.status === "rejected");
  const succeeded = results.filter((r) => r.status === "fulfilled");

  console.log(`\nResults: ${succeeded.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    console.error("\nFailed fixtures:");
    failed.forEach((r) => {
      if (r.status === "rejected") {
        console.error(`  - ${r.reason}`);
      }
    });
    process.exit(1);
  }

  console.log("\nAll fixtures updated successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
