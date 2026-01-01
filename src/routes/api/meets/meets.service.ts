import {
  fetchHtml,
  parseHtml,
  tableToJson,
  withCache,
} from "../../../utils/scraper";
import type { GetMeetParamType, GetMeetQueryType } from "./meets.validation";

const CACHE_TTL = 3600;

type MeetResult = Record<string, string>;

async function fetchMeetData(meet: string): Promise<MeetResult[]> {
  const html = await fetchHtml(`/m/${meet}`);
  const doc = parseHtml(html);
  const table = doc.querySelector("table");
  return tableToJson(table) as MeetResult[];
}

export async function getMeet({
  meet,
  cache: useCache = true,
}: GetMeetParamType & GetMeetQueryType): Promise<MeetResult[] | null> {
  const result = await withCache<MeetResult[]>(
    { key: `meet-${meet}`, ttlSeconds: CACHE_TTL },
    () => fetchMeetData(meet),
    useCache,
  );

  return result.data;
}
