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

const LIFT_PREFIXES = ["squat", "bench", "deadlift"] as const;
const ATTEMPTS_PER_LIFT = 4;
const REGEX_TRAILING_DIGIT = /\d$/;

function isAttemptColumn(key: string): boolean {
  for (const prefix of LIFT_PREFIXES) {
    if (key !== prefix && key.startsWith(prefix) && REGEX_TRAILING_DIGIT.test(key)) {
      return true;
    }
  }
  return false;
}

function pickBestAttempt(row: Record<string, string>, prefix: string): string {
  let best = "";
  let bestValue = -Infinity;

  for (let i = 1; i <= ATTEMPTS_PER_LIFT; i++) {
    const value = row[`${prefix}${i}`] ?? "";
    if (value === "") continue;

    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) continue;

    if (numeric > bestValue) {
      best = value;
      bestValue = numeric;
    }
  }

  return best;
}

export function transformCompetitionResults(
  rows: ReadonlyArray<Record<string, string>>,
): CompetitionResult[] {
  const results: CompetitionResult[] = [];

  for (const row of rows) {
    const transformed: Record<string, string> = {};

    for (const key of Object.keys(row)) {
      if (!isAttemptColumn(key)) {
        transformed[key] = row[key]!;
      }
    }

    for (const prefix of LIFT_PREFIXES) {
      transformed[prefix] = pickBestAttempt(row, prefix);
    }

    results.push(transformed as CompetitionResult);
  }

  return results;
}

export function createUserService(scraper: ScraperType) {
  function parseUserProfileHtml(
    doc: Document,
    username: string,
    includeAttempts: boolean = false,
  ): UserProfile {
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
    const rawCompetitionResults = tables[1]
      ? scraper.tableToJson<Record<string, string>>(tables[1])
      : [];
    const competitionResults = includeAttempts
      ? (rawCompetitionResults as CompetitionResult[])
      : transformCompetitionResults(rawCompetitionResults);

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

  async function fetchUserProfile(
    username: string,
    includeAttempts: boolean = false,
    units: string = "lbs",
  ): Promise<UserProfile> {
    const html = await scraper.fetchHtml(`/u/${username}`, units);
    const doc = scraper.parseHtml(html);
    return parseUserProfileHtml(doc, username, includeAttempts);
  }

  async function getUser(
    { username }: GetUserType,
    includeAttempts: boolean = false,
    units: string = "lbs",
  ): Promise<UserProfile[] | null> {
    const cacheKey = `user-${username}${includeAttempts ? "-attempts" : ""}-${units}`;
    const result = await scraper.withCache<UserProfile>(cacheKey, () =>
      fetchUserProfile(username, includeAttempts, units),
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
    units = "lbs",
  }: GetUsersType): Promise<{
    data: RankingRow[] | null;
    pagination?: SearchPagination;
  }> {
    if (!search) {
      return { data: null };
    }

    try {
      const offset = (current_page - 1) * per_page;
      const searchResult = await scraper.fetchJson<{ next_index: number }>(
        `/search/rankings?q=${encodeURIComponent(search)}&start=${offset}`,
      );

      const startIndex = searchResult.next_index;
      const endIndex = startIndex + per_page - 1;

      const query = `start=${startIndex}&end=${endIndex}&lang=en&units=${units}`;
      const response = await scraper.fetchJson<RankingsApiResponse>(`/rankings?${query}`);

      const rows = response.rows.map(transformRankingRow);

      return {
        data: rows,
        pagination: {
          per_page,
          current_page,
        },
      };
    } catch {
      return { data: null };
    }
  }

  return {
    parseUserProfileHtml,
    getUser,
    searchUser,
  };
}
