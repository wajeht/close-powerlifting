import cron, { ScheduledTask } from "node-cron";

import { configuration } from "./configuration";
import type { CacheType } from "./db/cache";
import type { UserRepositoryType } from "./db/user";
import type { MailType } from "./mail";
import type { LoggerType } from "./utils/logger";
import type { ScraperType } from "./utils/scraper";
import type { RankingsApiResponse } from "./types";
import { transformRankingRow } from "./routes/api/rankings/rankings.service";

const RANKINGS_PAGES_TO_REFRESH = 10;
const REFRESH_DELAY_MS = 2000;
const CACHE_TTL = 90000;

export interface CronType {
  start: () => void;
  stop: () => void;
  getStatus: () => { isRunning: boolean; jobCount: number };
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

  async function refreshCacheTask() {
    const startTime = Date.now();
    logger.info("cron job started: refreshCache");

    const results: RefreshResult[] = [];
    const { defaultPerPage } = configuration.pagination;

    // 1. Refresh status
    results.push(
      await refreshEndpoint("status", async () => {
        const html = await scraper.fetchHtml("/status");
        const doc = scraper.parseHtml(html);
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

        const statusData = {
          server_version: serverVersion,
          meets: meetsInfo,
          federations,
        };

        await cache.set("status", JSON.stringify(statusData), CACHE_TTL);
      }),
    );
    await delay(REFRESH_DELAY_MS);

    // 2. Refresh federations list
    results.push(
      await refreshEndpoint("federations", async () => {
        const html = await scraper.fetchHtml("/mlist");
        const doc = scraper.parseHtml(html);
        const table = doc.querySelector("table");
        const federationsList = scraper.tableToJson(table);
        await cache.set("federations-list", JSON.stringify(federationsList), CACHE_TTL);
      }),
    );
    await delay(REFRESH_DELAY_MS);

    // 3. Refresh records
    results.push(
      await refreshEndpoint("records", async () => {
        const html = await scraper.fetchHtml("/records");
        const doc = scraper.parseHtml(html);
        const recordCols = doc.getElementsByClassName("records-col");
        const recordsData: Array<{ title: string; records: Record<string, string>[] }> = [];

        for (const col of recordCols) {
          const heading = col.querySelector("h2, h3");
          const table = col.querySelector("table");

          if (heading && table) {
            recordsData.push({
              title: heading.textContent?.trim() || "",
              records: scraper.tableToJson<Record<string, string>>(table),
            });
          }
        }

        await cache.set("records", JSON.stringify(recordsData), CACHE_TTL);
      }),
    );
    await delay(REFRESH_DELAY_MS);

    // 4. Refresh rankings pages 1-10
    for (let page = 1; page <= RANKINGS_PAGES_TO_REFRESH; page++) {
      results.push(
        await refreshEndpoint(`rankings-page-${page}`, async () => {
          const query = scraper.buildPaginationQuery(page, defaultPerPage);
          const response = await scraper.fetchJson<RankingsApiResponse>(`/rankings?${query}`);
          const cacheKey = `rankings-${page}-${defaultPerPage}`;
          const data = {
            rows: response.rows.map(transformRankingRow),
            totalLength: response.total_length,
          };
          await cache.set(cacheKey, JSON.stringify(data), CACHE_TTL);
        }),
      );
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

  function start(): void {
    cronJobs.push(cron.schedule("0 4 * * *", refreshCacheTask));
    cronJobs.push(cron.schedule("0 0 * * *", sendReachingApiLimitEmailTask));
    cronJobs.push(cron.schedule("0 0 * * *", resetApiCallCountTask));

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

  return { start, stop, getStatus };
}
