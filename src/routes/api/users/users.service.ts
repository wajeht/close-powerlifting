import type { Knex } from "knex";

import type { ScraperType } from "../../../context";
import { configuration } from "../../../configuration";
import type {
  UserProfile,
  PersonalBest,
  CompetitionResult,
  RankingRow,
  ProgressionPoint,
  PersonalBestEntry,
  PersonalBestsByEquipment,
  UserComparison,
  UserComparisonSummary,
  SharedMeetEntry,
  UserRank,
} from "../../../types";
import type { GetUserType, GetUsersType, GetCompareType } from "./users.validation";
import { liftRowToRankingRow, type LiftRow as RankingLiftRow } from "../rankings/rankings.service";

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
    if (numeric <= 0) continue;

    if (numeric > bestValue) {
      best = value;
      bestValue = numeric;
    }
  }

  return best;
}

function pickField(row: CompetitionResult, ...candidates: string[]): string {
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

function toNumber(value: string): number {
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function buildProgression(profile: UserProfile): ProgressionPoint[] {
  const points: ProgressionPoint[] = profile.competition_results.map((row) => ({
    date: pickField(row, "date"),
    meet: pickField(row, "competition", "meet", "meetname"),
    federation: pickField(row, "fed", "federation"),
    equipment: pickField(row, "equip", "equipment"),
    weight_class: pickField(row, "class", "weight_class"),
    bodyweight: pickField(row, "weight", "bodyweight"),
    squat: pickField(row, "squat"),
    bench: pickField(row, "bench"),
    deadlift: pickField(row, "deadlift"),
    total: pickField(row, "total"),
    dots: pickField(row, "dots"),
    place: pickField(row, "place"),
  }));

  points.sort((a, b) => a.date.localeCompare(b.date));

  return points;
}

function emptyEntry(): PersonalBestEntry {
  return { value: "", meet: "", date: "", federation: "" };
}

function maybeUpdateBest(
  current: PersonalBestEntry,
  candidateValue: string,
  row: CompetitionResult,
): PersonalBestEntry {
  if (candidateValue === "") return current;
  const numeric = toNumber(candidateValue);
  if (numeric <= 0) return current;
  if (current.value !== "" && toNumber(current.value) >= numeric) return current;

  return {
    value: candidateValue,
    meet: pickField(row, "competition", "meet", "meetname"),
    date: pickField(row, "date"),
    federation: pickField(row, "fed", "federation"),
  };
}

export function buildPersonalBests(profile: UserProfile): PersonalBestsByEquipment[] {
  const grouped = new Map<string, PersonalBestsByEquipment>();

  for (const row of profile.competition_results) {
    const equipment = pickField(row, "equip", "equipment");
    if (!equipment) continue;

    const existing = grouped.get(equipment) ?? {
      equipment,
      squat: emptyEntry(),
      bench: emptyEntry(),
      deadlift: emptyEntry(),
      total: emptyEntry(),
      dots: emptyEntry(),
    };

    const updated: PersonalBestsByEquipment = {
      equipment,
      squat: maybeUpdateBest(existing.squat, pickField(row, "squat"), row),
      bench: maybeUpdateBest(existing.bench, pickField(row, "bench"), row),
      deadlift: maybeUpdateBest(existing.deadlift, pickField(row, "deadlift"), row),
      total: maybeUpdateBest(existing.total, pickField(row, "total"), row),
      dots: maybeUpdateBest(existing.dots, pickField(row, "dots"), row),
    };

    grouped.set(equipment, updated);
  }

  return [...grouped.values()];
}

export function buildComparisonSummary(profile: UserProfile): UserComparisonSummary {
  let bestTotal = 0;
  let bestTotalStr = "";
  let bestDots = 0;
  let bestDotsStr = "";
  let bestSquat = 0;
  let bestSquatStr = "";
  let bestBench = 0;
  let bestBenchStr = "";
  let bestDeadlift = 0;
  let bestDeadliftStr = "";
  let earliestDate = "";
  let latestDate = "";

  for (const row of profile.competition_results) {
    const total = toNumber(pickField(row, "total"));
    if (total > bestTotal) {
      bestTotal = total;
      bestTotalStr = pickField(row, "total");
    }

    const dots = toNumber(pickField(row, "dots"));
    if (dots > bestDots) {
      bestDots = dots;
      bestDotsStr = pickField(row, "dots");
    }

    const squat = toNumber(pickField(row, "squat"));
    if (squat > bestSquat) {
      bestSquat = squat;
      bestSquatStr = pickField(row, "squat");
    }

    const bench = toNumber(pickField(row, "bench"));
    if (bench > bestBench) {
      bestBench = bench;
      bestBenchStr = pickField(row, "bench");
    }

    const deadlift = toNumber(pickField(row, "deadlift"));
    if (deadlift > bestDeadlift) {
      bestDeadlift = deadlift;
      bestDeadliftStr = pickField(row, "deadlift");
    }

    const date = pickField(row, "date");
    if (date && (earliestDate === "" || date < earliestDate)) earliestDate = date;
    if (date && (latestDate === "" || date > latestDate)) latestDate = date;
  }

  return {
    name: profile.name,
    username: profile.username,
    sex: profile.sex,
    total_meets: profile.competition_results.length,
    best_total: bestTotalStr,
    best_dots: bestDotsStr,
    best_squat: bestSquatStr,
    best_bench: bestBenchStr,
    best_deadlift: bestDeadliftStr,
    first_meet_date: earliestDate,
    last_meet_date: latestDate,
  };
}

export function findSharedMeets(a: UserProfile, b: UserProfile): SharedMeetEntry[] {
  const bIndex = new Map<string, CompetitionResult>();
  for (const row of b.competition_results) {
    const key = `${pickField(row, "date")}::${pickField(row, "competition", "meet", "meetname")}`;
    if (!bIndex.has(key)) bIndex.set(key, row);
  }

  const shared: SharedMeetEntry[] = [];
  for (const aRow of a.competition_results) {
    const date = pickField(aRow, "date");
    const meet = pickField(aRow, "competition", "meet", "meetname");
    const key = `${date}::${meet}`;
    const bRow = bIndex.get(key);
    if (!bRow) continue;

    shared.push({
      date,
      meet,
      federation: pickField(aRow, "fed", "federation"),
      a_total: pickField(aRow, "total"),
      a_dots: pickField(aRow, "dots"),
      a_place: pickField(aRow, "place"),
      b_total: pickField(bRow, "total"),
      b_dots: pickField(bRow, "dots"),
      b_place: pickField(bRow, "place"),
    });
  }

  shared.sort((a, b) => a.date.localeCompare(b.date));
  return shared;
}

export function buildUserRank(profile: UserProfile, globalRank: number | null): UserRank {
  let bestDots = 0;
  let bestDotsStr = "";
  let bestEquip = "";
  let bestWeightClass = "";
  let bestTotalStr = "";
  let bestTotalNumeric = 0;

  for (const row of profile.competition_results) {
    const dots = toNumber(pickField(row, "dots"));
    if (dots > bestDots) {
      bestDots = dots;
      bestDotsStr = pickField(row, "dots");
      bestEquip = pickField(row, "equip", "equipment");
      bestWeightClass = pickField(row, "class", "weight_class");
    }
    const total = toNumber(pickField(row, "total"));
    if (total > bestTotalNumeric) {
      bestTotalNumeric = total;
      bestTotalStr = pickField(row, "total");
    }
  }

  return {
    username: profile.username,
    name: profile.name,
    sex: profile.sex,
    best_total: bestTotalStr,
    best_dots: bestDotsStr,
    best_equipment: bestEquip,
    best_weight_class: bestWeightClass,
    global_rank: globalRank,
  };
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

interface LiftDbRow {
  name: string;
  sex: string | null;
  event: string | null;
  equipment: string | null;
  age: number | null;
  age_class: string | null;
  division: string | null;
  bodyweight_kg: number | null;
  weight_class_kg: number | null;
  squat1_kg: number | null;
  squat2_kg: number | null;
  squat3_kg: number | null;
  squat4_kg: number | null;
  bench1_kg: number | null;
  bench2_kg: number | null;
  bench3_kg: number | null;
  bench4_kg: number | null;
  deadlift1_kg: number | null;
  deadlift2_kg: number | null;
  deadlift3_kg: number | null;
  deadlift4_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  place: string | null;
  dots: number | null;
  federation: string | null;
  date: string;
  meet_country: string | null;
  meet_state: string | null;
  meet_name: string | null;
}

const KG_TO_LBS = 2.20462;

function formatValue(value: number | string | null | undefined): string {
  if (value == null || value === "") return "";
  return String(value);
}

function formatWeight(value: number | null | undefined, units: "kg" | "lbs"): string {
  if (value == null) return "";
  const converted = units === "lbs" ? value * KG_TO_LBS : value;
  return formatWeightNumber(converted);
}

function formatWeightNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function buildLocation(country: string | null, state: string | null): string {
  if (country && state) return `${country}-${state}`;
  return country ?? "";
}

function liftRowToCompetitionResult(
  row: LiftDbRow,
  includeAttempts: boolean,
  units: "kg" | "lbs",
): CompetitionResult {
  const base: Record<string, string> = {
    place: formatValue(row.place),
    fed: formatValue(row.federation),
    date: row.date,
    location: buildLocation(row.meet_country, row.meet_state),
    competition: formatValue(row.meet_name),
    division: formatValue(row.division),
    age: formatValue(row.age),
    equip: formatValue(row.equipment),
    class: formatWeight(row.weight_class_kg, units),
    weight: formatWeight(row.bodyweight_kg, units),
    total: formatWeight(row.total_kg, units),
    dots: formatValue(row.dots),
  };

  if (includeAttempts) {
    base.squat1 = formatWeight(row.squat1_kg, units);
    base.squat2 = formatWeight(row.squat2_kg, units);
    base.squat3 = formatWeight(row.squat3_kg, units);
    base.squat4 = formatWeight(row.squat4_kg, units);
    base.bench1 = formatWeight(row.bench1_kg, units);
    base.bench2 = formatWeight(row.bench2_kg, units);
    base.bench3 = formatWeight(row.bench3_kg, units);
    base.bench4 = formatWeight(row.bench4_kg, units);
    base.deadlift1 = formatWeight(row.deadlift1_kg, units);
    base.deadlift2 = formatWeight(row.deadlift2_kg, units);
    base.deadlift3 = formatWeight(row.deadlift3_kg, units);
    base.deadlift4 = formatWeight(row.deadlift4_kg, units);
  } else {
    base.squat = formatWeight(row.best3_squat_kg, units);
    base.bench = formatWeight(row.best3_bench_kg, units);
    base.deadlift = formatWeight(row.best3_deadlift_kg, units);
  }

  return base as CompetitionResult;
}

function buildPersonalBestsFromLifts(
  rows: ReadonlyArray<LiftDbRow>,
  units: "kg" | "lbs",
): PersonalBest[] {
  const byEquipment = new Map<
    string,
    {
      equip: string;
      squat: number;
      bench: number;
      deadlift: number;
      total: number;
      dots: number;
    }
  >();

  for (const row of rows) {
    const equip = row.equipment ?? "";
    if (!equip) continue;
    const current = byEquipment.get(equip) ?? {
      equip,
      squat: 0,
      bench: 0,
      deadlift: 0,
      total: 0,
      dots: 0,
    };

    if ((row.best3_squat_kg ?? 0) > current.squat) current.squat = row.best3_squat_kg ?? 0;
    if ((row.best3_bench_kg ?? 0) > current.bench) current.bench = row.best3_bench_kg ?? 0;
    if ((row.best3_deadlift_kg ?? 0) > current.deadlift)
      current.deadlift = row.best3_deadlift_kg ?? 0;
    if ((row.total_kg ?? 0) > current.total) current.total = row.total_kg ?? 0;
    if ((row.dots ?? 0) > current.dots) current.dots = row.dots ?? 0;

    byEquipment.set(equip, current);
  }

  return [...byEquipment.values()].map((entry) => ({
    equip: entry.equip,
    squat: entry.squat ? formatWeight(entry.squat, units) : "",
    bench: entry.bench ? formatWeight(entry.bench, units) : "",
    deadlift: entry.deadlift ? formatWeight(entry.deadlift, units) : "",
    total: entry.total ? formatWeight(entry.total, units) : "",
    dots: entry.dots ? String(entry.dots) : "",
  })) as PersonalBest[];
}

export function buildUserProfileFromLifts(
  rows: ReadonlyArray<LiftDbRow>,
  slug: string,
  includeAttempts: boolean,
  units: "kg" | "lbs" = "lbs",
): UserProfile | null {
  if (rows.length === 0) return null;

  const first = rows[0]!;
  const name = first.name;
  const sex = first.sex ?? "";

  const competitionResults = rows.map((row) =>
    liftRowToCompetitionResult(row, includeAttempts, units),
  );
  const personalBest = buildPersonalBestsFromLifts(rows, units);

  return {
    name,
    username: slug,
    sex,
    instagram: "",
    instagram_url: "",
    personal_best: personalBest,
    competition_results: competitionResults,
  };
}

export function createUserService(knex: Knex, scraper: ScraperType) {
  async function fetchUserProfileFromDb(
    slug: string,
    includeAttempts: boolean = false,
    units: "kg" | "lbs" = "lbs",
  ): Promise<UserProfile | null> {
    const rows = await knex<LiftDbRow>("lifts")
      .select(
        "name",
        "sex",
        "event",
        "equipment",
        "age",
        "age_class",
        "division",
        "bodyweight_kg",
        "weight_class_kg",
        "squat1_kg",
        "squat2_kg",
        "squat3_kg",
        "squat4_kg",
        "bench1_kg",
        "bench2_kg",
        "bench3_kg",
        "bench4_kg",
        "deadlift1_kg",
        "deadlift2_kg",
        "deadlift3_kg",
        "deadlift4_kg",
        "best3_squat_kg",
        "best3_bench_kg",
        "best3_deadlift_kg",
        "total_kg",
        "place",
        "dots",
        "federation",
        "date",
        "meet_country",
        "meet_state",
        "meet_name",
      )
      .where({ name_slug: slug })
      .orderBy("date", "desc");

    return buildUserProfileFromLifts(rows, slug, includeAttempts, units);
  }

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

  function normalizeUnits(units: string): "kg" | "lbs" {
    return units === "kg" ? "kg" : "lbs";
  }

  async function getUser(
    { username }: GetUserType,
    includeAttempts: boolean = false,
    units: string = "lbs",
  ): Promise<UserProfile[] | null> {
    const profile = await fetchUserProfileFromDb(username, includeAttempts, normalizeUnits(units));
    if (!profile) return null;
    return [profile];
  }

  async function getUserProfileCached(
    username: string,
    units: string = "lbs",
  ): Promise<UserProfile | null> {
    return fetchUserProfileFromDb(username, false, normalizeUnits(units));
  }

  async function getProgression(
    { username }: GetUserType,
    units: string = "lbs",
  ): Promise<ProgressionPoint[] | null> {
    const profile = await getUserProfileCached(username, units);
    if (!profile) return null;
    return buildProgression(profile);
  }

  async function getPersonalBests(
    { username }: GetUserType,
    units: string = "lbs",
  ): Promise<PersonalBestsByEquipment[] | null> {
    const profile = await getUserProfileCached(username, units);
    if (!profile) return null;
    return buildPersonalBests(profile);
  }

  async function compareUsers(
    { a, b }: GetCompareType,
    units: string = "lbs",
  ): Promise<UserComparison | null> {
    const [profileA, profileB] = await Promise.all([
      getUserProfileCached(a, units),
      getUserProfileCached(b, units),
    ]);

    if (!profileA || !profileB) return null;

    return {
      a: buildComparisonSummary(profileA),
      b: buildComparisonSummary(profileB),
      shared_meets: findSharedMeets(profileA, profileB),
    };
  }

  async function fetchGlobalRank(username: string): Promise<number | null> {
    try {
      const result = await scraper.fetchJson<{ next_index: number }>(
        `/search/rankings?q=${encodeURIComponent(username)}&start=0`,
      );
      if (!Number.isInteger(result.next_index) || result.next_index < 0) return null;
      return result.next_index + 1;
    } catch {
      return null;
    }
  }

  async function getRank(
    { username }: GetUserType,
    units: string = "lbs",
  ): Promise<UserRank | null> {
    const profile = await getUserProfileCached(username, units);
    if (!profile) return null;

    const cacheKey = `user-${username}-rank`;
    const cached = await scraper.withCache<number | null>(cacheKey, () =>
      fetchGlobalRank(username),
    );
    return buildUserRank(profile, cached.data ?? null);
  }

  interface SearchPagination {
    per_page: number;
    current_page: number;
  }

  function buildFtsQuery(search: string): string {
    const tokens = search
      .normalize("NFKD")
      .replace(/[\p{Mn}]/gu, "")
      .toLowerCase()
      .split(/\s+/)
      .map((token) => token.replace(/[^a-z0-9]/g, ""))
      .filter((token) => token.length > 0);
    if (tokens.length === 0) return "";
    return tokens.map((token) => `${token}*`).join(" ");
  }

  async function fetchUserSearchData({
    search,
    per_page,
    current_page,
    units,
  }: Required<Pick<GetUsersType, "search" | "per_page" | "current_page" | "units">>): Promise<{
    rows: RankingRow[];
    pagination: SearchPagination;
  }> {
    const ftsQuery = buildFtsQuery(search);
    if (!ftsQuery) {
      return { rows: [], pagination: { per_page, current_page } };
    }

    const offset = (current_page - 1) * per_page;
    const normalizedUnits: "kg" | "lbs" = units === "kg" ? "kg" : "lbs";

    const matchedSubquery = knex("lifts")
      .distinct("name_slug")
      .whereRaw("id IN (SELECT rowid FROM lifts_fts WHERE lifts_fts MATCH ?)", [ftsQuery]);

    const innerQuery = knex("lifts")
      .select(
        "name",
        "name_slug",
        "sex",
        "event",
        "equipment",
        "age",
        "bodyweight_kg",
        "weight_class_kg",
        "best3_squat_kg",
        "best3_bench_kg",
        "best3_deadlift_kg",
        "total_kg",
        "dots",
        "wilks",
        "glossbrenner",
        "goodlift",
        "federation",
        "parent_federation",
        "date",
        "meet_country",
        "meet_state",
        "meet_name",
        knex.raw("ROW_NUMBER() OVER (PARTITION BY name_slug ORDER BY dots DESC) AS rn"),
      )
      .whereIn("name_slug", matchedSubquery);

    const deduped = (await knex
      .select<RankingLiftRow[]>("*")
      .from(innerQuery.as("ranked"))
      .where("rn", 1)
      .orderBy("dots", "desc")
      .limit(per_page)
      .offset(offset)) as RankingLiftRow[];

    const rows = deduped.map((row, idx) =>
      liftRowToRankingRow(row, offset + idx + 1, normalizedUnits),
    );

    return {
      rows,
      pagination: { per_page, current_page },
    };
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
    const normalizedSearch = search?.trim();
    if (!normalizedSearch) {
      return { data: null };
    }

    const result = await fetchUserSearchData({
      search: normalizedSearch,
      per_page,
      current_page,
      units,
    });

    return {
      data: result.rows,
      pagination: result.pagination,
    };
  }

  function parseUserCacheKey(key: string): {
    kind: "profile" | "rank" | "search";
    username?: string;
    includeAttempts?: boolean;
    units?: string;
    search?: string;
    current_page?: number;
    per_page?: number;
  } | null {
    if (key.startsWith("users-search-")) {
      const remainder = key.slice("users-search-".length);
      const lastDash = remainder.lastIndexOf("-");
      if (lastDash === -1) return null;
      const secondLastDash = remainder.lastIndexOf("-", lastDash - 1);
      if (secondLastDash === -1) return null;
      const thirdLastDash = remainder.lastIndexOf("-", secondLastDash - 1);
      if (thirdLastDash === -1) return null;

      const units = remainder.slice(lastDash + 1);
      const perPage = parseInt(remainder.slice(secondLastDash + 1, lastDash), 10);
      const currentPage = parseInt(remainder.slice(thirdLastDash + 1, secondLastDash), 10);
      const encoded = remainder.slice(0, thirdLastDash);

      if ((units !== "lbs" && units !== "kg") || isNaN(currentPage) || isNaN(perPage)) {
        return null;
      }

      return {
        kind: "search",
        search: decodeURIComponent(encoded),
        current_page: currentPage,
        per_page: perPage,
        units,
      };
    }

    if (!key.startsWith("user-")) return null;
    let remainder = key.slice("user-".length);

    if (remainder.endsWith("-rank")) {
      const username = remainder.slice(0, -"-rank".length);
      if (!username) return null;
      return { kind: "rank", username };
    }

    let units: string | undefined;
    if (remainder.endsWith("-kg")) {
      units = "kg";
      remainder = remainder.slice(0, -"-kg".length);
    } else if (remainder.endsWith("-lbs")) {
      units = "lbs";
      remainder = remainder.slice(0, -"-lbs".length);
    } else {
      return null;
    }

    let includeAttempts = false;
    if (remainder.endsWith("-attempts")) {
      includeAttempts = true;
      remainder = remainder.slice(0, -"-attempts".length);
    }

    if (!remainder) return null;
    return { kind: "profile", username: remainder, includeAttempts, units };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseUserCacheKey(key);
    if (!parsed) return false;

    if (parsed.kind === "profile") {
      // Profile data is served from the lifts table now; legacy cache keys
      // can no longer be refreshed. Claim the key so the cron does not warn.
      return true;
    }

    if (parsed.kind === "rank") {
      await scraper.refreshCache<number | null>(key, () => fetchGlobalRank(parsed.username!));
      return true;
    }

    if (parsed.kind === "search") {
      // Search now hits the lifts FTS index; legacy cache keys are claimed
      // without re-scraping.
      return true;
    }

    return false;
  }

  return {
    parseUserProfileHtml,
    parseUserCacheKey,
    fetchUserProfileFromDb,
    getUser,
    searchUser,
    getProgression,
    getPersonalBests,
    compareUsers,
    getRank,
    refreshCacheKey,
  };
}
