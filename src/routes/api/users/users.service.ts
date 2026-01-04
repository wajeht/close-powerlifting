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
import { transformRankingRow } from "../rankings/rankings.service";

const { defaultPerPage } = configuration.pagination;

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
    const result = await scraper.withCache<UserProfile>(`user-${username}`, () =>
      fetchUserProfile(username),
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
