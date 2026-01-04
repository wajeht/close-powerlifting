import type { ScraperType } from "../../../context";
import type { StatusData, Federation, ApiResponse } from "../../../types";
import type { GetStatusType } from "./status.validation";

const CACHE_KEY = "status";
const CACHE_TTL = 90000;

export function createStatusService(scraper: ScraperType) {
  function parseStatusHtml(doc: Document): StatusData {
    const textContent = scraper.getElementByClass(doc, "text-content");
    if (!textContent) {
      throw new Error("Could not find text-content element on status page");
    }

    let serverVersion = "";
    const h2s = textContent.querySelectorAll("h2");
    for (const h2 of h2s) {
      if (h2.textContent?.includes("Server Version")) {
        const p = h2.nextElementSibling;
        const link = p?.querySelector("a");
        const href = link?.getAttribute("href") || "";
        const match = href.match(/commits\/([a-f0-9]+)/);
        serverVersion = match?.[1] ?? "";
        break;
      }
    }

    let meetsInfo = "";
    for (const h2 of h2s) {
      if (h2.textContent?.includes("Meets")) {
        let sibling = h2.nextSibling;
        while (sibling) {
          if (sibling.nodeType === 3) {
            const text = sibling.textContent?.trim() || "";
            if (text.includes("Tracking")) {
              meetsInfo = text;
              break;
            }
          }
          if (sibling.nodeType === 1) break;
          sibling = sibling.nextSibling;
        }
        break;
      }
    }

    const table = textContent.querySelector("table");
    const federations = scraper.tableToJson(table) as Federation[];

    return {
      server_version: serverVersion,
      meets: meetsInfo,
      federations,
    };
  }

  async function fetchStatus(): Promise<StatusData> {
    const html = await scraper.fetchHtml("/status");
    const doc = scraper.parseHtml(html);
    return parseStatusHtml(doc);
  }

  async function getStatus(_options: GetStatusType): Promise<ApiResponse<StatusData>> {
    return scraper.withCache<StatusData>({ key: CACHE_KEY, ttlSeconds: CACHE_TTL }, fetchStatus);
  }

  return {
    parseStatusHtml,
    getStatus,
  };
}
