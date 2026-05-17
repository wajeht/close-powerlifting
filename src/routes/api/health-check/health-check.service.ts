import type { CacheType, ScraperType, LoggerType } from "../../../context";

interface RouteStatus {
  status: boolean;
  method: string;
  url: string;
  date: string;
  body: string | null;
}

interface RouteGroup {
  name: string;
  routes: RouteStatus[];
}

interface RouteDefinition {
  group: string;
  path: string;
}

const ROUTE_DEFINITIONS: RouteDefinition[] = [
  // Rankings
  { group: "Rankings", path: "/api/rankings" },
  { group: "Rankings", path: "/api/rankings/1" },
  { group: "Rankings", path: "/api/rankings?current_page=1&per_page=100" },
  { group: "Rankings", path: "/api/rankings?units=kg" },
  { group: "Rankings", path: "/api/rankings?federation=uspa" },
  { group: "Rankings", path: "/api/rankings/filter/raw" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-dots" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-wilks" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-glossbrenner" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-goodlift" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-mcculloch" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-total" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-squat" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-bench" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-deadlift" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men?age_class=40-44" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men?federation=ipf" },
  {
    group: "Rankings",
    path: "/api/rankings/filter/raw/men?units=kg&federation=uspa&age_class=24-34",
  },

  // Federations
  { group: "Federations", path: "/api/federations" },
  { group: "Federations", path: "/api/federations?current_page=1&per_page=100" },
  { group: "Federations", path: "/api/federations/ipf" },
  { group: "Federations", path: "/api/federations/ipf?year=2020" },
  { group: "Federations", path: "/api/federations/ipf/stats" },

  // Records
  { group: "Records", path: "/api/records" },
  { group: "Records", path: "/api/records/raw" },
  { group: "Records", path: "/api/records/raw/men" },
  { group: "Records", path: "/api/records/raw/ipf-classes" },
  { group: "Records", path: "/api/records/raw/ipf-classes/men" },
  { group: "Records", path: "/api/records?age_class=40-44" },
  { group: "Records", path: "/api/records/raw/men?age_class=20-23" },
  { group: "Records", path: "/api/records/raw/ipf-classes/men?age_class=over80" },

  // Users
  { group: "Users", path: "/api/users/johnhaack" },
  { group: "Users", path: "/api/users/johnhaack?include_attempts=true" },
  { group: "Users", path: "/api/users/johnhaack?units=kg" },
  { group: "Users", path: "/api/users?search=haack" },
  { group: "Users", path: "/api/users?search=haack&units=kg" },
  { group: "Users", path: "/api/users/johnhaack/progression" },
  { group: "Users", path: "/api/users/johnhaack/progression?units=kg" },
  { group: "Users", path: "/api/users/johnhaack/personal-bests" },
  { group: "Users", path: "/api/users/johnhaack/rank" },
  { group: "Users", path: "/api/users/compare?a=johnhaack&b=kristyhawkins" },

  // Public (no auth)
  { group: "Public", path: "/api/status" },
  { group: "Public", path: "/api/health-check" },
];

const CACHE_KEY = "close-powerlifting-global-status-call-cache";

export function createHealthCheckService(
  cache: CacheType,
  scraper: ScraperType,
  logger: LoggerType,
) {
  async function getAPIStatus({
    apiKey,
    url,
  }: {
    apiKey: string;
    url: string;
  }): Promise<RouteGroup[]> {
    const cachedData = await cache.get(CACHE_KEY);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
    return refreshAPIStatus({ apiKey, url });
  }

  async function refreshAPIStatus({ apiKey, url }: { apiKey: string; url: string }) {
    const promises = await Promise.allSettled(
      ROUTE_DEFINITIONS.map((r) => scraper.fetchWithAuth(url, r.path, apiKey)),
    );

    const groupOrder = ["Rankings", "Federations", "Records", "Users", "Public"];
    const groupMap = new Map<string, RouteStatus[]>();

    for (const groupName of groupOrder) {
      groupMap.set(groupName, []);
    }

    for (let i = 0; i < ROUTE_DEFINITIONS.length; i++) {
      const routeDefinition = ROUTE_DEFINITIONS[i];
      if (!routeDefinition) continue;

      const promise = promises[i];
      const result = promise != null && promise.status === "fulfilled" ? promise.value : null;

      const routeStatus: RouteStatus = {
        status: Boolean(result?.ok),
        method: "GET",
        url: routeDefinition.path,
        date: result?.date || new Date().toISOString(),
        body: result?.ok ? (result.body ?? null) : null,
      };

      groupMap.get(routeDefinition.group)?.push(routeStatus);
    }

    const groups: RouteGroup[] = [];
    for (const groupName of groupOrder) {
      const routes = groupMap.get(groupName);
      if (routes != null && routes.length > 0) {
        groups.push({ name: groupName, routes });
      }
    }

    await cache.set(CACHE_KEY, JSON.stringify(groups));
    logger.info("Global status cache was updated!");

    return groups;
  }

  return {
    getAPIStatus,
    refreshAPIStatus,
  };
}
