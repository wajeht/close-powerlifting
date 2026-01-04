import type { CacheType, ScraperType, LoggerType } from "../../../context";

export function createHealthCheckService(
  cache: CacheType,
  scraper: ScraperType,
  logger: LoggerType,
) {
  async function getAPIStatus({ X_API_KEY, url }: { X_API_KEY: string; url: string }) {
    const fetchStatus = async () => {
      const routes = [
        // Rankings
        "/api/rankings",
        "/api/rankings/1",
        "/api/rankings?current_page=1&per_page=100",
        "/api/rankings/filter/raw",
        "/api/rankings/filter/raw/men",
        "/api/rankings/filter/raw/men/100",
        "/api/rankings/filter/raw/men/100/2024",
        "/api/rankings/filter/raw/men/100/2024/full-power",
        "/api/rankings/filter/raw/men/100/2024/full-power/by-dots",

        // Federations
        "/api/federations",
        "/api/federations?current_page=1&per_page=100",
        "/api/federations/ipf",
        "/api/federations/ipf?year=2020",

        // Meets
        "/api/meets/uspa/1969",

        // Records
        "/api/records",
        "/api/records/raw",
        "/api/records/raw/men",

        // Users
        "/api/users/johnhaack",
        "/api/users?search=haack",

        // Public (no auth)
        "/api/status",
        "/api/health-check",
      ];

      const promises = await Promise.allSettled(
        routes.map((r) => scraper.fetchWithAuth(url, r, X_API_KEY)),
      );

      const data = promises.map((p, i) => {
        const fulfilled = p.status === "fulfilled";
        const result = fulfilled ? p.value : null;

        return {
          status: fulfilled && result?.ok,
          method: "GET",
          url: routes[i],
          date: result?.date || new Date().toISOString(),
        };
      });

      return data;
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
