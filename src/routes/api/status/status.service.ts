import {
  fetchHtml,
  parseHtml,
  tableToJson,
  stripHtml,
  getElementByClass,
  withCache,
} from "../../../utils/scraper";
import type { StatusData, Federation, ApiResponse } from "../../../types/api";
import type { GetStatusType } from "./status.validation";

const CACHE_KEY = "status";
const CACHE_TTL = 3600;

async function fetchStatus(): Promise<StatusData> {
  const html = await fetchHtml("/status");
  const doc = parseHtml(html);

  const textContent = getElementByClass(doc, "text-content");
  if (!textContent) {
    throw new Error("Could not find text-content element on status page");
  }

  // Extract server version commit hash from the link in the paragraph after "Server Version" h2
  let serverVersion = "";
  const h2s = textContent.querySelectorAll("h2");
  for (const h2 of h2s) {
    if (h2.textContent?.includes("Server Version")) {
      const p = h2.nextElementSibling;
      const link = p?.querySelector("a");
      const href = link?.getAttribute("href") || "";
      const match = href.match(/commits\/([a-f0-9]+)/);
      serverVersion = match ? match[1] : "";
      break;
    }
  }

  // Extract meets info from paragraph containing "Tracking"
  const paragraphs = textContent.querySelectorAll("p");
  let meetsInfo = "";
  for (const p of paragraphs) {
    const text = p.textContent || "";
    if (text.includes("Tracking")) {
      meetsInfo = text.trim();
      break;
    }
  }

  // Extract federations table
  const table = textContent.querySelector("table");
  const federations = tableToJson(table) as Federation[];

  return {
    server_version: serverVersion,
    meets: meetsInfo,
    federations,
  };
}

export async function getStatus({
  cache: useCache = true,
}: GetStatusType): Promise<ApiResponse<StatusData>> {
  return withCache<StatusData>({ key: CACHE_KEY, ttlSeconds: CACHE_TTL }, fetchStatus, useCache);
}
