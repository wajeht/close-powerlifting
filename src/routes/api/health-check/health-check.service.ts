import { cache } from "../../../db/cache";
import { fetchWithAuth } from "../../../utils/scraper";
import { logger } from "../../../utils/logger";

export async function getAPIStatus({ X_API_KEY, url }: { X_API_KEY: string; url: string }) {
  const fetchStatus = async () => {
    const routes = [
      // Rankings
      "/api/rankings?cache=false",
      "/api/rankings/1?cache=false",
      "/api/rankings?current_page=1&per_page=100&cache=false",
      "/api/rankings/filter/raw?cache=false",
      "/api/rankings/filter/raw/men?cache=false",
      "/api/rankings/filter/raw/men/100?cache=false",
      "/api/rankings/filter/raw/men/100/2024?cache=false",
      "/api/rankings/filter/raw/men/100/2024/full-power?cache=false",
      "/api/rankings/filter/raw/men/100/2024/full-power/by-dots?cache=false",

      // Federations
      "/api/federations?cache=false",
      "/api/federations?current_page=1&per_page=100&cache=false",
      "/api/federations/ipf?cache=false",
      "/api/federations/ipf?year=2020&cache=false",

      // Meets
      "/api/meets/uspa/1969?cache=false",

      // Records
      "/api/records?cache=false",
      "/api/records/raw?cache=false",
      "/api/records/raw/men?cache=false",

      // Users
      "/api/users/johnhaack?cache=false",
      "/api/users?search=haack&cache=false",

      // Public (no auth)
      "/api/status?cache=false",
      "/api/health-check?cache=false",
    ];

    const promises = await Promise.allSettled(routes.map((r) => fetchWithAuth(url, r, X_API_KEY)));

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

    // Cache for 24 hours (86400 seconds)
    await cache.set(cacheKey, JSON.stringify(data), 86400);

    logger.info("Global status cache was updated!");
  }

  return data;
}
