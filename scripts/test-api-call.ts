import { createLogger } from "../src/utils/logger";

const logger = createLogger();

const API_KEY = process.env.API_KEY || process.argv[2] || "";
const BASE_URL = "https://closepowerlifting.com";

const ROUTES = [
  // Health Check (no auth required)
  { path: "/api/health-check", requiresAuth: false },

  // Status
  { path: "/api/status", requiresAuth: true },

  // Rankings
  { path: "/api/rankings", requiresAuth: true },
  { path: "/api/rankings/1", requiresAuth: true },
  { path: "/api/rankings/filter/raw", requiresAuth: true },
  { path: "/api/rankings/filter/raw/men", requiresAuth: true },
  { path: "/api/rankings/filter/raw/men/100", requiresAuth: true },
  { path: "/api/rankings/filter/raw/men/100/2024", requiresAuth: true },
  { path: "/api/rankings/filter/raw/men/100/2024/full-power", requiresAuth: true },
  { path: "/api/rankings/filter/raw/men/100/2024/full-power/by-dots", requiresAuth: true },

  // Federations
  { path: "/api/federations", requiresAuth: true },
  { path: "/api/federations/uspa", requiresAuth: true },
  { path: "/api/federations/usapl", requiresAuth: true },
  { path: "/api/federations/ipf", requiresAuth: true },

  // Meets
  { path: "/api/meets/uspa/1969", requiresAuth: true },

  // Records - All equipment types
  { path: "/api/records", requiresAuth: true },
  { path: "/api/records/raw", requiresAuth: true },
  { path: "/api/records/wraps", requiresAuth: true },
  { path: "/api/records/single", requiresAuth: true },
  { path: "/api/records/multi", requiresAuth: true },
  { path: "/api/records/unlimited", requiresAuth: true },
  { path: "/api/records/all-tested", requiresAuth: true },

  // Records - Equipment + Sex
  { path: "/api/records/raw/men", requiresAuth: true },
  { path: "/api/records/raw/women", requiresAuth: true },
  { path: "/api/records/wraps/men", requiresAuth: true },
  { path: "/api/records/wraps/women", requiresAuth: true },
  { path: "/api/records/single/men", requiresAuth: true },
  { path: "/api/records/single/women", requiresAuth: true },
  { path: "/api/records/multi/men", requiresAuth: true },
  { path: "/api/records/multi/women", requiresAuth: true },
  { path: "/api/records/unlimited/men", requiresAuth: true },
  { path: "/api/records/unlimited/women", requiresAuth: true },
  { path: "/api/records/all-tested/men", requiresAuth: true },
  { path: "/api/records/all-tested/women", requiresAuth: true },

  // Records - Equipment + Weight Class
  { path: "/api/records/raw/expanded-classes", requiresAuth: true },
  { path: "/api/records/raw/ipf-classes", requiresAuth: true },
  { path: "/api/records/unlimited/wp-classes", requiresAuth: true },
  { path: "/api/records/unlimited/para-classes", requiresAuth: true },

  // Records - Equipment + Weight Class + Sex
  { path: "/api/records/raw/ipf-classes/men", requiresAuth: true },
  { path: "/api/records/raw/ipf-classes/women", requiresAuth: true },
  { path: "/api/records/raw/expanded-classes/men", requiresAuth: true },
  { path: "/api/records/raw/expanded-classes/women", requiresAuth: true },
  { path: "/api/records/unlimited/wp-classes/men", requiresAuth: true },
  { path: "/api/records/unlimited/wp-classes/women", requiresAuth: true },
  { path: "/api/records/unlimited/para-classes/men", requiresAuth: true },
  { path: "/api/records/unlimited/para-classes/women", requiresAuth: true },

  // Users
  { path: "/api/users?search=haack", requiresAuth: true },
  { path: "/api/users/johnhaack", requiresAuth: true },
];

interface TestResult {
  path: string;
  status: number;
  success: boolean;
  error?: string;
}

async function testRoute(route: { path: string; requiresAuth: boolean }): Promise<TestResult> {
  const url = `${BASE_URL}${route.path}`;
  const headers: Record<string, string> = {};

  if (route.requiresAuth) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  try {
    const response = await fetch(url, { headers });
    const data = await response.json();

    return {
      path: route.path,
      status: response.status,
      success: response.ok,
      error: response.ok ? undefined : data.message,
    };
  } catch (error) {
    return {
      path: route.path,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  if (!API_KEY) {
    logger.error("Usage: API_KEY=<your-api-key> npx tsx scripts/test-api-call.ts");
    logger.error("   or: npx tsx scripts/test-api-call.ts <your-api-key>");
    process.exit(1);
  }

  logger.info("Starting API tests against production server...");
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`Testing ${ROUTES.length} routes\n`);

  const results: TestResult[] = [];

  for (const route of ROUTES) {
    const result = await testRoute(route);
    results.push(result);

    const statusIcon = result.success ? "✓" : "✗";
    const statusColor = result.success ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";

    logger.info(
      `${statusColor}${statusIcon}${reset} [${result.status}] ${result.path}${result.error ? ` - ${result.error}` : ""}`,
    );
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info(`\n${"=".repeat(50)}`);
  logger.info(`Results: ${passed} passed, ${failed} failed out of ${ROUTES.length} total`);

  if (failed > 0) {
    logger.info("\nFailed routes:");
    for (const result of results.filter((r) => !r.success)) {
      logger.info(`  - ${result.path}: ${result.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Test API call failed:", error);
  process.exit(1);
});
