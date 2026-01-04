import type { ScraperType } from "../../../context";
import { configuration } from "../../../configuration";
import type {
  UserProfile,
  PersonalBest,
  CompetitionResult,
  RankingRow,
  RankingsApiResponse,
} from "../../../types";
import type { GetUserType, GetUsersType } from "./users.validation";

const CACHE_TTL = 1800;
const { defaultPerPage } = configuration.pagination;

function transformRankingRow(row: (string | number)[]): RankingRow {
  const username = String(row[3] || "");
  const meetCode = String(row[12] || "");
  const instagram = String(row[4] || "");

  return {
    id: Number(row[0]) || 0,
    rank: Number(row[1]) || 0,
    full_name: String(row[2] || ""),
    username,
    user_profile: `/api/users/${username}`,
    instagram,
    instagram_url: instagram ? `https://www.instagram.com/${instagram}` : "",
    username_color: String(row[5] || ""),
    country: String(row[6] || ""),
    location: String(row[7] || ""),
    fed: String(row[8] || ""),
    federation_url: meetCode ? `/api/federations/${meetCode.split("/")[0]}` : "",
    date: String(row[9] || ""),
    country_two: String(row[10] || ""),
    state: String(row[11] || ""),
    meet_code: meetCode,
    meet_url: meetCode ? `/api/meets/${meetCode}` : "",
    sex: String(row[13] || ""),
    equip: String(row[14] || ""),
    age: parseInt(String(row[15]), 10) || 0,
    open: String(row[16] || ""),
    body_weight: parseFloat(String(row[17])) || 0,
    weight_class: parseFloat(String(row[18])) || 0,
    squat: parseFloat(String(row[19])) || 0,
    bench: parseFloat(String(row[20])) || 0,
    deadlift: parseFloat(String(row[21])) || 0,
    total: parseFloat(String(row[22])) || 0,
    dots: parseFloat(String(row[23])) || 0,
  };
}

export function createUserService(scraper: ScraperType) {
  function parseUserProfileHtml(doc: Document, username: string): UserProfile {
    const mixedContent = scraper.getElementByClass(doc, "mixed-content");
    if (!mixedContent) {
      throw new Error(`User profile not found: ${username}`);
    }

    const h1 = mixedContent.querySelector("h1");
    const nameSpan = h1?.querySelector("span.green") || h1?.querySelector("span");
    const name = nameSpan?.textContent?.trim() || username;

    const h1Text = h1?.textContent || "";
    const sexMatch = h1Text.match(/\(([MF])\)/);
    const sex = sexMatch?.[1] ?? "";

    const igLink = h1?.querySelector("a.instagram");
    const igHref = igLink?.getAttribute("href") || "";
    const igMatch = igHref.match(/instagram\.com\/([^/]+)/);
    const instagram = igMatch?.[1] ?? "";

    const tables = mixedContent.querySelectorAll("table");
    const personalBest = tables[0] ? scraper.tableToJson<PersonalBest>(tables[0]) : [];
    const competitionResults = tables[1] ? scraper.tableToJson<CompetitionResult>(tables[1]) : [];

    return {
      name,
      username,
      sex,
      instagram,
      instagram_url: instagram ? `https://www.instagram.com/${instagram}` : "",
      personal_best: personalBest,
      competition_results: competitionResults,
    };
  }

  async function fetchUserProfile(username: string): Promise<UserProfile> {
    const html = await scraper.fetchHtml(`/u/${username}`);
    const doc = scraper.parseHtml(html);
    return parseUserProfileHtml(doc, username);
  }

  async function getUser({ username }: GetUserType): Promise<UserProfile[] | null> {
    const result = await scraper.withCache<UserProfile>(
      { key: `user-${username}`, ttlSeconds: CACHE_TTL },
      () => fetchUserProfile(username),
      true,
    );

    if (!result.data) {
      return null;
    }

    return [result.data];
  }

  interface SearchPagination {
    per_page: number;
    current_page: number;
  }

  async function searchUser({
    search,
    per_page = defaultPerPage,
    current_page = 1,
  }: GetUsersType): Promise<{
    data: RankingRow[] | null;
    cache: boolean;
    pagination?: SearchPagination;
  }> {
    if (!search) {
      return { data: null, cache: false };
    }

    try {
      const offset = (current_page - 1) * per_page;
      const searchResult = await scraper.fetchJson<{ next_index: number }>(
        `/search/rankings?q=${encodeURIComponent(search)}&start=${offset}`,
      );

      const startIndex = searchResult.next_index;
      const endIndex = startIndex + per_page - 1;

      const query = `start=${startIndex}&end=${endIndex}&lang=en&units=lbs`;
      const response = await scraper.fetchJson<RankingsApiResponse>(`/rankings?${query}`);

      const rows = response.rows.map(transformRankingRow);

      return {
        data: rows,
        cache: false,
        pagination: {
          per_page,
          current_page,
        },
      };
    } catch {
      return { data: null, cache: false };
    }
  }

  return {
    parseUserProfileHtml,
    getUser,
    searchUser,
  };
}
