import {
  fetchHtml,
  parseHtml,
  tableToJson,
  withCache,
} from "../../../utils/scraper";
import type { MeetData, MeetResult, ApiResponse } from "../../../types/api";
import type { GetMeetParamType, GetMeetQueryType } from "./meets.validation";

const CACHE_TTL = 3600;

async function fetchMeetData(meet: string): Promise<MeetData> {
  const html = await fetchHtml(`/m/${meet}`);
  const doc = parseHtml(html);

  const h1 = doc.querySelector("h1");
  const title = h1?.textContent?.trim() || "";

  const h2 = doc.querySelector("h2");
  const dateLocation = h2?.textContent?.trim() || "";
  const [date, ...locationParts] = dateLocation.split(",").map((s) => s.trim());
  const location = locationParts.join(", ");

  const table = doc.querySelector("table");
  const results = tableToJson(table) as MeetResult[];

  return {
    title,
    date: date || "",
    location: location || "",
    results,
  };
}

export async function getMeet({
  meet,
  cache: useCache = true,
}: GetMeetParamType & GetMeetQueryType): Promise<ApiResponse<MeetData>> {
  return withCache<MeetData>(
    { key: `meet-${meet}`, ttlSeconds: CACHE_TTL },
    () => fetchMeetData(meet),
    useCache,
  );
}
