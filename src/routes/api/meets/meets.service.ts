import type { ScraperType } from "../../../context";
import type { MeetData, MeetResult, ApiResponse } from "../../../types";
import type { GetMeetParamType } from "./meets.validation";

export function createMeetService(scraper: ScraperType) {
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

  async function getMeet({ meet }: GetMeetParamType): Promise<ApiResponse<MeetData>> {
    return scraper.withCache<MeetData>(`meet-${meet}`, () => fetchMeetData(meet));
  }

  return {
    parseMeetHtml,
    getMeet,
  };
}
