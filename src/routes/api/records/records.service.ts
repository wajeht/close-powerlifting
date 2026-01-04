import type { ScraperType } from "../../../context";
import type { RecordCategory, ApiResponse } from "../../../types";
import type {
  GetRecordsType,
  GetFilteredRecordsParamType,
  GetFilteredRecordsQueryType,
} from "./records.validation";

export function createRecordService(scraper: ScraperType) {
  function parseRecordsHtml(doc: Document): RecordCategory[] {
    const recordCols = doc.getElementsByClassName("records-col");
    const data: RecordCategory[] = [];

    for (const col of recordCols) {
      const heading = col.querySelector("h2, h3");
      const table = col.querySelector("table");

      if (heading && table) {
        data.push({
          title: heading.textContent?.trim() || "",
          records: scraper.tableToJson<Record<string, string>>(table),
        });
      }
    }

    return data;
  }

  async function fetchRecordsData(filterPath: string = ""): Promise<RecordCategory[]> {
    const html = await scraper.fetchHtml(`/records${filterPath}`);
    const doc = scraper.parseHtml(html);
    return parseRecordsHtml(doc);
  }

  async function getRecords(_options: GetRecordsType): Promise<ApiResponse<RecordCategory[]>> {
    return scraper.withCache<RecordCategory[]>("records", () => fetchRecordsData());
  }

  function buildRecordsFilterPath(filters: GetFilteredRecordsParamType): string {
    const parts: string[] = [];
    if (filters.equipment) parts.push(filters.equipment);
    if (filters.sex) parts.push(filters.sex);
    return parts.length > 0 ? `/${parts.join("/")}` : "";
  }

  async function getFilteredRecords(
    filters: GetFilteredRecordsParamType,
    _query: GetFilteredRecordsQueryType,
  ): Promise<ApiResponse<RecordCategory[]>> {
    const filterPath = buildRecordsFilterPath(filters);
    const cacheKey = `records${filterPath}`;

    return scraper.withCache<RecordCategory[]>(cacheKey, () => fetchRecordsData(filterPath));
  }

  return {
    parseRecordsHtml,
    getRecords,
    getFilteredRecords,
  };
}
