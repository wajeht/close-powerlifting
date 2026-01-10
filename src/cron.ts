import cron, { ScheduledTask } from "node-cron";

import { configuration } from "./configuration";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { ApiCallLogRepositoryType } from "./db/api-call-log";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";
import type {
  RankingsApiResponse,
  Meet,
  MeetData,
  MeetResult,
  RecordCategory,
  UserProfile,
  PersonalBest,
  CompetitionResult,
} from "./types";
import { transformRankingRow } from "./routes/api/rankings/rankings.service";

const REFRESH_DELAY_MS = process.env.NODE_ENV === "testing" ? 0 : 2000;

const INTERNAL_CACHE_KEYS = ["hostname", "close-powerlifting-global-status-call-cache"];

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
  tasks: {
    refreshCache: () => Promise<void>;
    resetApiCallCount: () => Promise<void>;
    sendReachingApiLimitEmail: () => Promise<void>;
    cleanupOldApiCallLogs: () => Promise<void>;
  };
}

interface RefreshResult {
  endpoint: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

export function createCron(
  cache: CacheType,
  userRepository: UserRepositoryType,
  mail: MailType,
  logger: LoggerType,
  scraper: ScraperType,
  apiCallLogRepository: ApiCallLogRepositoryType,
): CronType {
  let cronJobs: ScheduledTask[] = [];
  let isRunning = false;

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function refreshEndpoint(
    name: string,
    refreshFn: () => Promise<void>,
  ): Promise<RefreshResult> {
    const start = Date.now();
    try {
      logger.info(`refreshCache: refreshing ${name}`);
      await refreshFn();
      const durationMs = Date.now() - start;
      logger.info(`refreshCache: ${name} refreshed`, { durationMs });
      return { endpoint: name, success: true, durationMs };
    } catch (error) {
      const durationMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`refreshCache: failed to refresh ${name}`, { error: errorMessage });
      return { endpoint: name, success: false, error: errorMessage, durationMs };
    }
  }

  function parseStatusHtml(doc: Document): {
    server_version: string;
    meets: string;
    federations: Record<string, string>[];
  } {
    const textContent = scraper.getElementByClass(doc, "text-content");
    if (!textContent) {
      throw new Error("Could not find text-content element on status page");
    }

    let serverVersion = "";
    const h2s = textContent.querySelectorAll("h2");
    for (const h2 of h2s) {
      if (h2.textContent?.includes("Server Version")) {
        const p = h2.nextElementSibling;
        const link = p?.querySelector("a");
        const href = link?.getAttribute("href") || "";
        const match = href.match(/commits\/([a-f0-9]+)/);
        serverVersion = match?.[1] ?? "";
        break;
      }
    }

    let meetsInfo = "";
    for (const h2 of h2s) {
      if (h2.textContent?.includes("Meets")) {
        let sibling = h2.nextSibling;
        while (sibling) {
          if (sibling.nodeType === 3) {
            const text = sibling.textContent?.trim() || "";
            if (text.includes("Tracking")) {
              meetsInfo = text;
              break;
            }
          }
          if (sibling.nodeType === 1) break;
          sibling = sibling.nextSibling;
        }
        break;
      }
    }

    const table = textContent.querySelector("table");
    const federations = scraper.tableToJson(table);

    return {
      server_version: serverVersion,
      meets: meetsInfo,
      federations,
    };
  }

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

  async function refreshCacheKey(key: string): Promise<void> {
    // Status
    if (key === "status") {
      const html = await scraper.fetchHtml("/status");
      const doc = scraper.parseHtml(html);
      const data = parseStatusHtml(doc);
      await cache.set(key, JSON.stringify(data));
      return;
    }

    // Federations list
    if (key === "federations-list") {
      const html = await scraper.fetchHtml("/mlist");
      const doc = scraper.parseHtml(html);
      const table = doc.querySelector("table");
      const data = scraper.tableToJson(table) as Meet[];
      await cache.set(key, JSON.stringify(data));
      return;
    }

    // Federation (with optional year): federation-{fed} or federation-{fed}-{year}
    if (key.startsWith("federation-")) {
      const remainder = key.replace("federation-", "");
      // Check if ends with -YYYY (4 digit year)
      const yearMatch = remainder.match(/-(\d{4})$/);
      let federation: string;
      let year: string | undefined;

      if (yearMatch) {
        year = yearMatch[1];
        federation = remainder.slice(0, -5); // Remove -YYYY
      } else {
        federation = remainder;
      }

      const path = year ? `/mlist/${federation}/${year}` : `/mlist/${federation}`;
      const html = await scraper.fetchHtml(path);
      const doc = scraper.parseHtml(html);
      const table = doc.querySelector("table");
      const data = scraper.tableToJson(table) as Meet[];
      await cache.set(key, JSON.stringify(data));
      return;
    }

    // Meet: meet-{meetCode}
    if (key.startsWith("meet-")) {
      const meetCode = key.replace("meet-", "");
      const html = await scraper.fetchHtml(`/m/${meetCode}`);
      const doc = scraper.parseHtml(html);
      const data = parseMeetHtml(doc);
      await cache.set(key, JSON.stringify({ data }));
      return;
    }

    // Records: records or records/{filterPath}
    if (key === "records" || key.startsWith("records/")) {
      const filterPath = key === "records" ? "" : key.replace("records", "");
      const html = await scraper.fetchHtml(`/records${filterPath}`);
      const doc = scraper.parseHtml(html);
      const data = parseRecordsHtml(doc);
      await cache.set(key, JSON.stringify({ data }));
      return;
    }

    // User: user-{username}
    if (key.startsWith("user-")) {
      const username = key.replace("user-", "");
      const html = await scraper.fetchHtml(`/u/${username}`);
      const doc = scraper.parseHtml(html);
      const data = parseUserProfileHtml(doc, username);
      await cache.set(key, JSON.stringify({ data }));
      return;
    }

    // Rankings: rankings-{page}-{perPage} or rankings/{filterPath}-{page}-{perPage}
    if (key.startsWith("rankings")) {
      // Parse the key to extract filterPath, page, and perPage
      // Format: rankings-{page}-{perPage} or rankings/{filterPath}-{page}-{perPage}
      const lastDashIdx = key.lastIndexOf("-");
      const secondLastDashIdx = key.lastIndexOf("-", lastDashIdx - 1);

      if (lastDashIdx === -1 || secondLastDashIdx === -1) {
        logger.warn(`refreshCacheKey: invalid rankings key format: ${key}`);
        return;
      }

      const perPage = parseInt(key.substring(lastDashIdx + 1), 10);
      const page = parseInt(key.substring(secondLastDashIdx + 1, lastDashIdx), 10);
      const prefix = key.substring(0, secondLastDashIdx);

      if (isNaN(page) || isNaN(perPage)) {
        logger.warn(`refreshCacheKey: invalid page/perPage in key: ${key}`);
        return;
      }

      // prefix is either "rankings" or "rankings/{filterPath}"
      const filterPath = prefix === "rankings" ? "" : prefix.replace("rankings", "");
      const start = page === 1 ? 0 : (page - 1) * perPage;
      const end = start + perPage;
      const query = `start=${start}&end=${end}&lang=en&units=lbs`;
      const response = await scraper.fetchJson<RankingsApiResponse>(
        `/rankings${filterPath}?${query}`,
      );
      const data = {
        rows: response.rows.map(transformRankingRow),
        totalLength: response.total_length,
      };
      await cache.set(key, JSON.stringify(data));
      return;
    }

    logger.warn(`refreshCacheKey: unknown key type: ${key}`);
  }

  async function refreshCacheTask() {
    const startTime = Date.now();
    logger.info("cron job started: refreshCache");

    const allKeys = await cache.keys("%");
    const keysToRefresh = allKeys.filter((key) => !INTERNAL_CACHE_KEYS.includes(key));

    logger.info(`refreshCache: found ${keysToRefresh.length} keys to refresh`);

    const results: RefreshResult[] = [];

    for (const key of keysToRefresh) {
      results.push(await refreshEndpoint(key, () => refreshCacheKey(key)));
      await delay(REFRESH_DELAY_MS);
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);
    const totalDurationMs = Date.now() - startTime;

    logger.info("cron job completed: refreshCache", {
      total: results.length,
      successful,
      failed: failed.length,
      totalDurationMs,
      failedEndpoints: failed.map((f) => f.endpoint),
    });
  }

  async function resetApiCallCountTask() {
    try {
      logger.info("cron job started: resetApiCallCount");

      const today = new Date();
      if (today.getDate() !== 1) {
        logger.info("cron job skipped: resetApiCallCount (not start of month)");
        return;
      }

      const users = await userRepository.findVerified();
      await userRepository.resetAllApiCallCounts();

      for (const user of users) {
        await mail.sendApiLimitResetEmail({ email: user.email, name: user.name });
      }

      logger.info("cron job completed: resetApiCallCount");
    } catch (error) {
      logger.error("cron job failed: resetApiCallCount", error);
    }
  }

  async function sendReachingApiLimitEmailTask() {
    try {
      logger.info("cron job started: sendReachingApiLimitEmail");

      const targetCount = Math.floor(configuration.app.defaultApiCallLimit * 0.7);
      const users = await userRepository.findByApiCallCount(targetCount);

      for (const user of users) {
        await mail.sendReachingApiLimitEmail({
          email: user.email,
          name: user.name,
          percent: 70,
        });
      }

      logger.info("cron job completed: sendReachingApiLimitEmail");
    } catch (error) {
      logger.error("cron job failed: sendReachingApiLimitEmail", error);
    }
  }

  async function cleanupOldApiCallLogsTask() {
    try {
      logger.info("cron job started: cleanupOldApiCallLogs");

      const retentionDays = configuration.app.apiCallLogRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deletedCount = await apiCallLogRepository.deleteOlderThan(cutoffDate);

      if (deletedCount > 0) {
        logger.info(`cron job completed: cleanupOldApiCallLogs - deleted ${deletedCount} logs`);
      } else {
        logger.info("cron job completed: cleanupOldApiCallLogs - no logs to delete");
      }
    } catch (error) {
      logger.error("cron job failed: cleanupOldApiCallLogs", error);
    }
  }

  function start(): void {
    cronJobs.push(cron.schedule("0 4 * * 0", refreshCacheTask)); // Weekly cache refresh: Sundays at 4:00 AM UTC
    cronJobs.push(cron.schedule("0 0 * * *", sendReachingApiLimitEmailTask)); // Daily email notification: every day at 12:00 AM UTC
    cronJobs.push(cron.schedule("0 0 * * *", resetApiCallCountTask)); // Daily API call count reset: every day at 12:00 AM UTC
    cronJobs.push(cron.schedule("0 3 * * *", cleanupOldApiCallLogsTask)); // Daily API call log cleanup: every day at 3:00 AM UTC

    isRunning = true;
    logger.info("cron service started", { jobs: cronJobs.length });
  }

  function stop(): void {
    for (const job of cronJobs) {
      job.stop();
    }
    cronJobs = [];
    isRunning = false;
    logger.info("cron service stopped");
  }

  function getStatus(): { isRunning: boolean; jobCount: number } {
    return { isRunning, jobCount: cronJobs.length };
  }

  return {
    start,
    stop,
    getStatus,
    tasks: {
      refreshCache: refreshCacheTask,
      resetApiCallCount: resetApiCallCountTask,
      sendReachingApiLimitEmail: sendReachingApiLimitEmailTask,
      cleanupOldApiCallLogs: cleanupOldApiCallLogsTask,
    },
  };
}
