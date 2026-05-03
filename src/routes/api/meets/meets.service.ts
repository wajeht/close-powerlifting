import type { ScraperType } from "../../../context";
import type {
  MeetData,
  MeetResult,
  ApiResponse,
  MeetHighlights,
  MeetHighlightLifter,
} from "../../../types";
import type { GetMeetParamType, GetMeetHighlightsParamType } from "./meets.validation";

const HIGHLIGHTS_TOP_N = 3;
const REGEX_MEET_SORT_SUFFIX = /-(by-[a-z0-9-]+)$/;

function meetField(row: MeetResult, ...candidates: string[]): string {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) {
        const value = row[key];
        if (value != null) return value;
      }
    }
  }
  return "";
}

function toLifter(row: MeetResult): MeetHighlightLifter {
  return {
    place: meetField(row, "rank", "place"),
    name: meetField(row, "lifter", "name"),
    sex: meetField(row, "sex"),
    weight_class: meetField(row, "class", "weight_class"),
    bodyweight: meetField(row, "weight", "bodyweight"),
    squat: meetField(row, "squat"),
    bench: meetField(row, "bench"),
    deadlift: meetField(row, "deadlift"),
    total: meetField(row, "total"),
    dots: meetField(row, "dots"),
  };
}

export function buildMeetHighlights(meet: MeetData): MeetHighlights {
  const lifters = meet.results;

  const byDots = [...lifters].sort(
    (a, b) => parseFloat(meetField(b, "dots") || "0") - parseFloat(meetField(a, "dots") || "0"),
  );
  const byTotal = [...lifters].sort(
    (a, b) => parseFloat(meetField(b, "total") || "0") - parseFloat(meetField(a, "total") || "0"),
  );

  const weightClasses = new Set<string>();
  for (const row of lifters) {
    const wc = meetField(row, "class", "weight_class");
    if (wc) weightClasses.add(wc);
  }

  return {
    title: meet.title,
    date: meet.date,
    location: meet.location,
    total_lifters: lifters.length,
    weight_classes_contested: [...weightClasses].sort(),
    top_by_dots: byDots.slice(0, HIGHLIGHTS_TOP_N).map(toLifter),
    top_by_total: byTotal.slice(0, HIGHLIGHTS_TOP_N).map(toLifter),
  };
}

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

  async function fetchMeetData(meet: string, sort?: string, units?: string): Promise<MeetData> {
    const sortPath = sort ? `/${sort}` : "";
    const html = await scraper.fetchHtml(`/m/${meet}${sortPath}`, units);
    const doc = scraper.parseHtml(html);
    return parseMeetHtml(doc);
  }

  async function getMeet(
    { meet }: GetMeetParamType,
    sort?: string,
    units?: string,
  ): Promise<ApiResponse<MeetData>> {
    const cacheKey = `meet-${meet}${sort ? `-${sort}` : ""}${units ? `-${units}` : ""}`;
    return scraper.withCache<MeetData>(cacheKey, () => fetchMeetData(meet, sort, units));
  }

  async function getMeetHighlights(
    { meet }: GetMeetHighlightsParamType,
    units?: string,
  ): Promise<ApiResponse<MeetHighlights>> {
    const meetPath = meet;
    const cacheKey = `meet-${meetPath}-highlights${units ? `-${units}` : ""}`;
    return scraper.withCache<MeetHighlights>(cacheKey, async () => {
      const data = await fetchMeetData(meetPath, undefined, units);
      return buildMeetHighlights(data);
    });
  }

  function parseMeetCacheKey(
    key: string,
  ): { path: string; sort?: string; units?: string; isHighlights: boolean } | null {
    if (!key.startsWith("meet-")) return null;
    let remainder = key.slice("meet-".length);

    let units: string | undefined;
    if (remainder.endsWith("-kg")) {
      units = "kg";
      remainder = remainder.slice(0, -"-kg".length);
    } else if (remainder.endsWith("-lbs")) {
      units = "lbs";
      remainder = remainder.slice(0, -"-lbs".length);
    }

    let isHighlights = false;
    if (remainder.endsWith("-highlights")) {
      isHighlights = true;
      remainder = remainder.slice(0, -"-highlights".length);
    }

    let sort: string | undefined;
    const sortMatch = remainder.match(REGEX_MEET_SORT_SUFFIX);
    if (sortMatch) {
      sort = sortMatch[1];
      remainder = remainder.slice(0, -sortMatch[0].length);
    }

    if (!remainder) return null;
    return { path: remainder, sort, units, isHighlights };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseMeetCacheKey(key);
    if (!parsed) return false;

    if (parsed.isHighlights) {
      await scraper.refreshCache<MeetHighlights>(key, async () => {
        const data = await fetchMeetData(parsed.path, undefined, parsed.units);
        return buildMeetHighlights(data);
      });
    } else {
      await scraper.refreshCache<MeetData>(key, () =>
        fetchMeetData(parsed.path, parsed.sort, parsed.units),
      );
    }

    return true;
  }

  return {
    parseMeetHtml,
    parseMeetCacheKey,
    getMeet,
    getMeetHighlights,
    refreshCacheKey,
  };
}
