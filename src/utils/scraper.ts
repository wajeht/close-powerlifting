import type { LoggerType } from "./logger";

const FETCH_TIMEOUT_MS = 15000;

export interface ScraperType {
  fetchWithAuth: (
    baseUrl: string,
    path: string,
    token: string,
  ) => Promise<{ ok: boolean; url: string; date: string | null; body: string | null }>;
}

export function createScraper(_logger: LoggerType): ScraperType {
  async function fetchWithAuth(
    baseUrl: string,
    path: string,
    token: string,
  ): Promise<{ ok: boolean; url: string; date: string | null; body: string | null }> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await response.text();
      return {
        ok: response.ok,
        url: path,
        date: response.headers.get("date"),
        body,
      };
    } catch {
      return {
        ok: false,
        url: path,
        date: new Date().toISOString(),
        body: null,
      };
    }
  }

  return { fetchWithAuth };
}
