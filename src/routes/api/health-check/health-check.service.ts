import type { CacheType, ScraperType, LoggerType } from "../../../context";

interface RouteStatus {
  status: boolean;
  method: string;
  url: string;
  date: string;
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
  { group: "Rankings", path: "/api/rankings/filter/raw" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power" },
  { group: "Rankings", path: "/api/rankings/filter/raw/men/100/2024/full-power/by-dots" },

  // Federations
  { group: "Federations", path: "/api/federations" },
  { group: "Federations", path: "/api/federations?current_page=1&per_page=100" },
  { group: "Federations", path: "/api/federations/ipf" },
  { group: "Federations", path: "/api/federations/ipf?year=2020" },

  // Meets
  { group: "Meets", path: "/api/meets/uspa/1969" },

  // Records
  { group: "Records", path: "/api/records" },
  { group: "Records", path: "/api/records/raw" },
  { group: "Records", path: "/api/records/raw/men" },

  // Users
  { group: "Users", path: "/api/users/johnhaack" },
  { group: "Users", path: "/api/users?search=haack" },

  // Public (no auth)
  { group: "Public", path: "/api/status" },
  { group: "Public", path: "/api/health-check" },
];

export function createHealthCheckService(
  cache: CacheType,
  scraper: ScraperType,
  logger: LoggerType,
) {
  async function getAPIStatus({ apiKey, url }: { apiKey: string; url: string }) {
    const fetchStatus = async () => {
      const promises = await Promise.allSettled(
        ROUTE_DEFINITIONS.map((r) => scraper.fetchWithAuth(url, r.path, apiKey)),
      );

      const groupOrder = ["Rankings", "Federations", "Meets", "Records", "Users", "Public"];
      const groupMap = new Map<string, RouteStatus[]>();

      for (const groupName of groupOrder) {
        groupMap.set(groupName, []);
      }

      ROUTE_DEFINITIONS.forEach((routeDefinition, i) => {
        const promise = promises[i];
        const isFulfilled = promise != null && promise.status === "fulfilled";
        const result = isFulfilled
          ? (promise as PromiseFulfilledResult<{ ok: boolean; url: string; date: string | null }>)
              .value
          : null;

        const routeStatus: RouteStatus = {
          status: Boolean(isFulfilled && result?.ok),
          method: "GET",
          url: routeDefinition.path,
          date: result?.date || new Date().toISOString(),
        };

        groupMap.get(routeDefinition.group)?.push(routeStatus);
      });

      const groups: RouteGroup[] = [];
      for (const groupName of groupOrder) {
        const routes = groupMap.get(groupName);
        if (routes != null && routes.length > 0) {
          groups.push({ name: groupName, routes });
        }
      }

      return groups;
    };

    const cacheKey = `close-powerlifting-global-status-call-cache`;

    const cachedData = await cache.get(cacheKey);
    let data = cachedData ? JSON.parse(cachedData) : null;

    if (data === null) {
      data = await fetchStatus();

      await cache.set(cacheKey, JSON.stringify(data));

      logger.info("Global status cache was updated!");
    }

    return data;
  }

  return {
    getAPIStatus,
  };
}
