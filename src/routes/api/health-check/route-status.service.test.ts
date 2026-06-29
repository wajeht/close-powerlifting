import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import {
  getCachedRouteStatuses,
  refreshRouteStatusesInBackground,
  resetRouteStatusesForTesting,
} from "./route-status.service";

describe("route status service", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetRouteStatusesForTesting();
  });

  it("refreshes endpoint probes outside the request path", async () => {
    stubFetch();

    const startedAt = Date.now();
    refreshRouteStatusesInBackground("http://127.0.0.1");

    expect(Date.now() - startedAt).toBeLessThan(50);
    expect(getCachedRouteStatuses()).toEqual([]);

    const groups = await waitForRouteGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.routes.every((route) => route.status))).toBe(true);
  });

  it("coalesces concurrent background refresh requests", async () => {
    let requestCount = 0;
    stubFetch(() => {
      requestCount += 1;
    });

    refreshRouteStatusesInBackground("http://127.0.0.1");
    refreshRouteStatusesInBackground("http://127.0.0.1");

    const groups = await waitForRouteGroups();
    const routeCount = groups.reduce((total, group) => total + group.routes.length, 0);
    expect(requestCount).toBe(routeCount);
  });

  it("uses representative status probes instead of broad expensive routes", async () => {
    stubFetch();

    refreshRouteStatusesInBackground("http://127.0.0.1");
    const groups = await waitForRouteGroups();
    const urls = groups.flatMap((group) => group.routes.map((route) => route.url));

    expect(urls).toContain("/api/rankings/filter/raw?federation=ipf&per_page=10");
    expect(urls).toContain("/api/rankings/filter/raw/men?federation=ipf&per_page=10");
    expect(urls).toContain("/api/records/raw/ipf-classes/men?age_class=40-44");
    expect(urls).not.toContain("/api/rankings/filter/raw");
    expect(urls).not.toContain("/api/rankings/filter/raw/men");
    expect(urls).not.toContain("/api/records?age_class=40-44");
  });

  it("caps cached response bodies", async () => {
    stubFetch(undefined, "x".repeat(10_000));

    refreshRouteStatusesInBackground("http://127.0.0.1");
    const groups = await waitForRouteGroups();
    const body = groups[0]?.routes[0]?.body;

    expect(body).toContain("[truncated]");
    expect(body?.length).toBeLessThan(2_100);
  });
});

function stubFetch(onRequest?: () => void, body?: string): void {
  globalThis.fetch = async (input) => {
    onRequest?.();
    return new Response(body ?? JSON.stringify({ ok: true, path: fetchInputUrl(input) }), {
      headers: {
        "content-type": "application/json",
        date: new Date().toUTCString(),
      },
      status: 200,
    });
  };
}

function fetchInputUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function waitForRouteGroups() {
  for (let i = 0; i < 100; i += 1) {
    const groups = getCachedRouteStatuses();
    if (groups.length > 0) return groups;
    await delay(10);
  }
  throw new Error("Timed out waiting for route status refresh");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
