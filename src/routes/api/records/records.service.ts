import {
  fetchHtml,
  parseHtml,
  tableToJson,
  withCache,
} from "../../../utils/scraper";
import type { RecordCategory, ApiResponse } from "../../../types/api";
import type { GetRecordsType } from "./records.validation";

const CACHE_TTL = 3600;

async function fetchRecordsData(): Promise<RecordCategory[]> {
  const html = await fetchHtml("/records");
  const doc = parseHtml(html);

  const recordCols = doc.getElementsByClassName("records-col");
  const data: RecordCategory[] = [];

  for (const col of recordCols) {
    const heading = col.querySelector("h2, h3");
    const table = col.querySelector("table");

    if (heading && table) {
      data.push({
        title: heading.textContent?.trim() || "",
        records: tableToJson<Record<string, string>>(table),
      });
    }
  }

  return data;
}

export async function getRecords({
  cache: useCache = true,
}: GetRecordsType): Promise<ApiResponse<RecordCategory[]>> {
  return withCache<RecordCategory[]>(
    { key: "records", ttlSeconds: CACHE_TTL },
    fetchRecordsData,
    useCache,
  );
}
