import { JSDOM } from "jsdom";
import { configuration } from "../configuration";
import { ScraperError } from "../error";
import type { ApiResponse, Pagination } from "../types";
import type { CacheType } from "../db/cache";
import type { LoggerType } from "./logger";

const DEFAULT_HEADERS: Record<string, string> = {
  Cookie: "units=lbs;",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0",
  Pragma: "no-cache",
};

export interface ScraperType {
  fetchHtml: (path: string) => Promise<string>;
  fetchJson: <T>(path: string) => Promise<T>;
  parseHtml: (html: string) => Document;
  tableToJson: <T extends Record<string, string> = Record<string, string>>(
    table: Element | null,
  ) => T[];
  stripHtml: (html: string) => string;
  getElementText: (parent: Element | Document, selector: string, index?: number) => string | null;
  getElementByClass: (doc: Document, className: string, index?: number) => Element | null;
  withCache: <T>(key: string, fetcher: () => Promise<T>) => Promise<ApiResponse<T>>;
  buildPaginationQuery: (currentPage: number, perPage: number) => string;
  calculatePagination: (totalItems: number, currentPage: number, perPage: number) => Pagination;
  fetchWithAuth: (
    baseUrl: string,
    path: string,
    token: string,
  ) => Promise<{ ok: boolean; url: string; date: string | null }>;
}

export function createScraper(cache: CacheType, logger: LoggerType): ScraperType {
  async function fetchHtml(path: string): Promise<string> {
    const url = `${configuration.app.baseUrl}${path.startsWith("/") ? path.slice(1) : path}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new ScraperError(`Failed to fetch ${path}`, response.status, path);
    }

    return response.text();
  }

  async function fetchJson<T>(path: string): Promise<T> {
    const url = `${configuration.app.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (!response.ok) {
      throw new ScraperError(`Failed to fetch API ${path}`, response.status, path);
    }

    return response.json() as Promise<T>;
  }

  function parseHtml(html: string): Document {
    const dom = new JSDOM(html);
    return dom.window.document;
  }

  function tableToJson<T extends Record<string, string> = Record<string, string>>(
    table: Element | null,
  ): T[] {
    if (!table) return [];

    const rows = table.querySelectorAll("tr");
    if (rows.length === 0) return [];

    const headerRow = rows[0];
    if (!headerRow) return [];

    const headers: string[] = [];
    for (const cell of headerRow.querySelectorAll("th, td")) {
      const text = cell.textContent?.trim().toLowerCase().replace(/\s+/g, "") || "";
      headers.push(text);
    }

    const data: T[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const cells = row.querySelectorAll("td");
      const rowData: Record<string, string> = {};

      let j = 0;
      for (const cell of cells) {
        const header = headers[j];
        if (header) {
          rowData[header] = cell.textContent?.trim() || "";
        }
        j++;
      }

      if (Object.keys(rowData).length > 0) {
        data.push(rowData as T);
      }
    }

    return data;
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
  }

  function getElementText(parent: Element | Document, selector: string, index = 0): string | null {
    const elements = parent.querySelectorAll(selector);
    const element = elements[index];
    return element?.textContent?.trim() || null;
  }

  function getElementByClass(doc: Document, className: string, index = 0): Element | null {
    const elements = doc.getElementsByClassName(className);
    return elements[index] || null;
  }

  async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<ApiResponse<T>> {
    try {
      const cached = await cache.get(key);
      if (cached) {
        return { data: JSON.parse(cached) as T, cache: true };
      }
    } catch (error) {
      logger.warn(`Cache read error for ${key}: ${error}`);
    }

    try {
      const data = await fetcher();

      cache.set(key, JSON.stringify(data)).catch((error) => {
        logger.warn(`Cache write error for ${key}: ${error}`);
      });

      return { data, cache: false };
    } catch (error) {
      logScraperError(error, key);
      return { data: null, cache: false };
    }
  }

  function logScraperError(error: unknown, context: string): void {
    if (error instanceof ScraperError) {
      if (error.isNotFound()) {
        logger.info(`Resource not found: ${error.path}`);
      } else {
        logger.error(`Scraper error [${context}]: ${error.message} (status: ${error.statusCode})`);
      }
    } else if (error instanceof Error) {
      logger.error(`Scraper error [${context}]: ${error.message}`);
    } else {
      logger.error(`Scraper error [${context}]: Unknown error`);
    }
  }

  function buildPaginationQuery(currentPage: number, perPage: number): string {
    const start = currentPage === 1 ? 0 : (currentPage - 1) * perPage;
    const end = start + perPage;
    return `start=${start}&end=${end}&lang=en&units=lbs`;
  }

  function calculatePagination(
    totalItems: number,
    currentPage: number,
    perPage: number,
  ): Pagination {
    const pages = Math.ceil(totalItems / perPage);
    const from = (currentPage - 1) * perPage + 1;
    const to = Math.min(currentPage * perPage, totalItems);

    return {
      items: totalItems,
      pages,
      per_page: perPage,
      current_page: currentPage,
      last_page: pages,
      first_page: 1,
      from,
      to,
    };
  }

  async function fetchWithAuth(
    baseUrl: string,
    path: string,
    token: string,
  ): Promise<{ ok: boolean; url: string; date: string | null }> {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      return {
        ok: response.ok,
        url: path,
        date: response.headers.get("date"),
      };
    } catch {
      return {
        ok: false,
        url: path,
        date: new Date().toISOString(),
      };
    }
  }

  return {
    fetchHtml,
    fetchJson,
    parseHtml,
    tableToJson,
    stripHtml,
    getElementText,
    getElementByClass,
    withCache,
    buildPaginationQuery,
    calculatePagination,
    fetchWithAuth,
  };
}
