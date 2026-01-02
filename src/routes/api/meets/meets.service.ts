import { Scraper } from "../../../utils/scraper";
import type { MeetData, MeetResult, ApiResponse } from "../../../types";
import type { GetMeetParamType, GetMeetQueryType } from "./meets.validation";

const CACHE_TTL = 3600;

export function MeetsService() {
  const scraper = Scraper();

  function parseMeetHtml(doc: Document): MeetData {
    const h1 = doc.querySelector("h1#meet");
    const title = h1?.textContent?.trim() || "";

    const p = h1?.nextElementSibling;
    const dateLocationText = p?.textContent?.trim().split("\n")[0] || "";
    const [date, ...locationParts] = dateLocationText.split(",").map((s) => s.trim());
    const location = locationParts.join(", ");

    const table = doc.querySelector("table");
    const results = scraper.tableToJson(table) as MeetResult[];

    return {
      title,
      date: date || "",
      location: location || "",
      results,
    };
  }

  async function fetchMeetData(meet: string): Promise<MeetData> {
    const html = await scraper.fetchHtml(`/m/${meet}`);
    const doc = scraper.parseHtml(html);
    return parseMeetHtml(doc);
  }

  async function getMeet({
    meet,
    cache: useCache = true,
  }: GetMeetParamType & GetMeetQueryType): Promise<ApiResponse<MeetData>> {
    return scraper.withCache<MeetData>(
      { key: `meet-${meet}`, ttlSeconds: CACHE_TTL },
      () => fetchMeetData(meet),
      useCache,
    );
  }

  return {
    parseMeetHtml,
    getMeet,
  };
}
