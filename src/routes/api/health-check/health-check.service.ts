import axios from "axios";

import cache from "../../../db/cache";
import logger from "../../../utils/logger";

export async function getAPIStatus({ X_API_KEY, url }: { X_API_KEY: string; url: string }) {
  const fetchStatus = async () => {
    const fetch = axios.create({
      baseURL: url,
      headers: {
        authorization: `Bearer ${X_API_KEY}`,
      },
    });

    const routes = [
      "/api/rankings?cache=false",
      "/api/rankings/1?cache=false",
      "/api/rankings?current_page=1&per_page=100&cache=false",
      "/api/federations?cache=false",
      "/api/federations?current_page=1&per_page=100&cache=false",
      "/api/federations/ipf?cache=false",
      "/api/federations/ipf?year=2020&cache=false",
      "/api/meets/uspa/1969?cache=false",
      "/api/records?cache=false",
      "/api/users/johnhaack?cache=false",
      "/api/users?search=haack&cache=false",
      "/api/status?cache=false",
      "/api/health-check?cache=false",
    ];

    const promises = await Promise.allSettled(routes.map((r) => fetch(r)));

    const data = promises.map((p) => {
      const fulfilled = p.status === "fulfilled";
      const config = fulfilled ? p.value?.config : p.reason?.config;
      const headers = fulfilled ? p.value?.headers : p.reason?.response?.headers;

      return {
        status: fulfilled,
        method: config?.method?.toUpperCase(),
        url: config?.url,
        date: headers?.date,
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
