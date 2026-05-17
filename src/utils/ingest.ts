import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform, Writable } from "node:stream";
import type { Knex } from "knex";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import type { LoggerType } from "./logger";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const LIFTS_BATCH_SIZE = 5000;
const REGEX_DIACRITICS = /\p{Mn}/gu;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;
const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_PLACE_NUMERIC = /^\d+$/;

export function nameToSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(REGEX_DIACRITICS, "")
    .toLowerCase()
    .replace(REGEX_SLUG_STRIP, "");
}

function trimToNull(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value: string | undefined): 0 | 1 {
  if (value == null) return 0;
  return value.trim().toLowerCase() === "yes" ? 1 : 0;
}

interface PlaceSplit {
  rank: number | null;
  status: string | null;
}

function splitPlace(value: string | undefined): PlaceSplit {
  const text = trimToNull(value);
  if (text == null) return { rank: null, status: null };
  if (REGEX_PLACE_NUMERIC.test(text)) {
    return { rank: parseInt(text, 10), status: null };
  }
  return { rank: null, status: text };
}

interface FederationDraft {
  slug: string;
  code: string;
  parent_slug: string | null;
}

interface LifterDraft {
  name: string;
  name_slug: string;
  sex: string | null;
  country: string | null;
  state: string | null;
}

interface MeetDraft {
  federation_slug: string;
  date: string;
  meet_name: string;
  meet_slug: string;
  meet_country: string | null;
  meet_state: string | null;
  sanctioned: 0 | 1;
}

interface NormalizedLift {
  lifter_slug: string;
  meet_key: string;
  event: string;
  equipment: string;
  age: number | null;
  age_class: string | null;
  birth_year_class: string | null;
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
  place_rank: number | null;
  place_status: string | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  tested: 0 | 1;
}

interface IngestStats {
  federations: number;
  lifters: number;
  meets: number;
  lifts: number;
  skippedRows: number;
}

export interface IngestResult {
  status: "completed" | "skipped" | "failed";
  stats: IngestStats;
  byteSize: number | null;
  durationMs: number;
  sourceLastModified: string | null;
  error?: string;
}

export type CsvStreamFactory = () => Readable;

export interface IngestServiceType {
  runNightly: (options?: { force?: boolean }) => Promise<IngestResult>;
  ingestFromStream: (
    csvStreamFactory: CsvStreamFactory,
    options?: { sourceLastModified?: string | null; byteSize?: number | null },
  ) => Promise<IngestResult>;
}

interface BetterSqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid: number | bigint };
    all: (...params: unknown[]) => unknown[];
  };
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
  exec: (sql: string) => void;
}

function meetKey(federationSlug: string, date: string, meetSlug: string): string {
  return `${federationSlug}|${date}|${meetSlug}`;
}

function normalizeRow(record: Record<string, string>): NormalizedLift | null {
  const name = trimToNull(record.Name);
  const date = trimToNull(record.Date);
  const event = trimToNull(record.Event);
  const equipment = trimToNull(record.Equipment);
  const federation = trimToNull(record.Federation);
  if (!name || !date || !event || !equipment || !federation) return null;
  if (!REGEX_ISO_DATE.test(date)) return null;

  const meetName = trimToNull(record.MeetName);
  if (!meetName) return null;

  const place = splitPlace(record.Place);
  const federationSlug = nameToSlug(federation);
  const meetSlug = nameToSlug(meetName);

  return {
    lifter_slug: nameToSlug(name),
    meet_key: meetKey(federationSlug, date, meetSlug),
    event,
    equipment,
    age: toNumber(record.Age),
    age_class: trimToNull(record.AgeClass),
    birth_year_class: trimToNull(record.BirthYearClass),
    division: trimToNull(record.Division),
    bodyweight_kg: toNumber(record.BodyweightKg),
    weight_class_kg: toNumber(record.WeightClassKg),
    squat1_kg: toNumber(record.Squat1Kg),
    squat2_kg: toNumber(record.Squat2Kg),
    squat3_kg: toNumber(record.Squat3Kg),
    squat4_kg: toNumber(record.Squat4Kg),
    bench1_kg: toNumber(record.Bench1Kg),
    bench2_kg: toNumber(record.Bench2Kg),
    bench3_kg: toNumber(record.Bench3Kg),
    bench4_kg: toNumber(record.Bench4Kg),
    deadlift1_kg: toNumber(record.Deadlift1Kg),
    deadlift2_kg: toNumber(record.Deadlift2Kg),
    deadlift3_kg: toNumber(record.Deadlift3Kg),
    deadlift4_kg: toNumber(record.Deadlift4Kg),
    best3_squat_kg: toNumber(record.Best3SquatKg),
    best3_bench_kg: toNumber(record.Best3BenchKg),
    best3_deadlift_kg: toNumber(record.Best3DeadliftKg),
    total_kg: toNumber(record.TotalKg),
    place_rank: place.rank,
    place_status: place.status,
    dots: toNumber(record.Dots),
    wilks: toNumber(record.Wilks),
    glossbrenner: toNumber(record.Glossbrenner),
    goodlift: toNumber(record.Goodlift),
    tested: toBool(record.Tested),
  };
}

function harvestDimensions(
  record: Record<string, string>,
  lift: NormalizedLift,
  federations: Map<string, FederationDraft>,
  lifters: Map<string, LifterDraft>,
  meets: Map<string, MeetDraft>,
): void {
  const federation = record.Federation!.trim();
  const federationSlug = nameToSlug(federation);
  if (!federations.has(federationSlug)) {
    const parent = trimToNull(record.ParentFederation);
    federations.set(federationSlug, {
      slug: federationSlug,
      code: federation,
      parent_slug: parent ? nameToSlug(parent) : null,
    });
  }

  if (!lifters.has(lift.lifter_slug)) {
    lifters.set(lift.lifter_slug, {
      name: record.Name!.trim(),
      name_slug: lift.lifter_slug,
      sex: trimToNull(record.Sex),
      country: trimToNull(record.Country),
      state: trimToNull(record.State),
    });
  }

  if (!meets.has(lift.meet_key)) {
    meets.set(lift.meet_key, {
      federation_slug: federationSlug,
      date: record.Date!.trim(),
      meet_name: record.MeetName!.trim(),
      meet_slug: nameToSlug(record.MeetName!),
      meet_country: trimToNull(record.MeetCountry),
      meet_state: trimToNull(record.MeetState),
      sanctioned: toBool(record.Sanctioned),
    });
  }
}

export function createIngestService(knex: Knex, logger: LoggerType): IngestServiceType {
  interface KnexClient {
    acquireConnection: () => Promise<BetterSqliteDatabase>;
    releaseConnection: (conn: BetterSqliteDatabase) => Promise<void>;
  }

  async function withDb<T>(fn: (db: BetterSqliteDatabase) => Promise<T> | T): Promise<T> {
    const client = knex.client as unknown as KnexClient;
    const db = await client.acquireConnection();
    try {
      return await fn(db);
    } finally {
      await client.releaseConnection(db);
    }
  }

  async function getLastSuccessfulSourceLastModified(): Promise<string | null> {
    const row = await knex("ingest_runs")
      .where({ status: "completed" })
      .whereNotNull("source_last_modified")
      .orderBy("started_at", "desc")
      .first<{ source_last_modified: string | null }>();
    return row?.source_last_modified ?? null;
  }

  async function recordRun(startedAt: Date, result: IngestResult): Promise<void> {
    await knex("ingest_runs").insert({
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      federation_count: result.stats.federations,
      lifter_count: result.stats.lifters,
      meet_count: result.stats.meets,
      lift_count: result.stats.lifts,
      byte_size: result.byteSize,
      source_last_modified: result.sourceLastModified,
      status: result.status,
      error: result.error ?? null,
    });
  }

  function csvParser(): Transform {
    return parseCsv({ columns: true, skip_empty_lines: true, relax_column_count: true });
  }

  async function ingestFromStream(
    csvStreamFactory: CsvStreamFactory,
    options: { sourceLastModified?: string | null; byteSize?: number | null } = {},
  ): Promise<IngestResult> {
    const startedAt = new Date();
    const sourceLastModified = options.sourceLastModified ?? null;
    const byteSize = options.byteSize ?? null;
    const stats: IngestStats = {
      federations: 0,
      lifters: 0,
      meets: 0,
      lifts: 0,
      skippedRows: 0,
    };

    try {
      // Pass 1 — stream the CSV once and harvest dimension dictionaries only.
      // No lift rows are buffered; backpressure flows through pipeline().
      const federations = new Map<string, FederationDraft>();
      const lifters = new Map<string, LifterDraft>();
      const meets = new Map<string, MeetDraft>();

      await pipeline(
        csvStreamFactory(),
        csvParser(),
        new Writable({
          objectMode: true,
          highWaterMark: LIFTS_BATCH_SIZE,
          write(record: Record<string, string>, _enc, callback) {
            const lift = normalizeRow(record);
            if (lift == null) {
              stats.skippedRows++;
            } else {
              harvestDimensions(record, lift, federations, lifters, meets);
            }
            callback();
          },
        }),
      );

      stats.federations = federations.size;
      stats.lifters = lifters.size;
      stats.meets = meets.size;

      logger.info(
        `ingest: pass 1 done — ${stats.lifters} lifters, ${stats.meets} meets, ${stats.federations} federations (skipped ${stats.skippedRows})`,
      );

      // Pass 2 — re-open the CSV, resolve FKs in flight, write lifts in batches.
      // Whole import runs inside a single manual transaction for atomicity.
      await withDb(async (db) => {
        db.exec("BEGIN");
        try {
          db.exec("DELETE FROM lifts");
          db.exec("DELETE FROM meets");
          db.exec("DELETE FROM lifters");
          db.exec("DELETE FROM federations");

          const lifterIds = new Map<string, number>();
          const meetIds = new Map<string, number>();
          const federationIds = new Map<string, number>();

          const insertFederation = db.prepare(
            "INSERT INTO federations (slug, code, parent_slug) VALUES (?, ?, ?)",
          );
          for (const fed of federations.values()) {
            const result = insertFederation.run(fed.slug, fed.code, fed.parent_slug);
            federationIds.set(fed.slug, Number(result.lastInsertRowid));
          }

          const insertLifter = db.prepare(
            "INSERT INTO lifters (name, name_slug, sex, country, state) VALUES (?, ?, ?, ?, ?)",
          );
          for (const lifter of lifters.values()) {
            const result = insertLifter.run(
              lifter.name,
              lifter.name_slug,
              lifter.sex,
              lifter.country,
              lifter.state,
            );
            lifterIds.set(lifter.name_slug, Number(result.lastInsertRowid));
          }

          const insertMeet = db.prepare(
            "INSERT INTO meets (federation_id, date, meet_name, meet_slug, meet_country, meet_state, sanctioned) VALUES (?, ?, ?, ?, ?, ?, ?)",
          );
          for (const meet of meets.values()) {
            const result = insertMeet.run(
              federationIds.get(meet.federation_slug)!,
              meet.date,
              meet.meet_name,
              meet.meet_slug,
              meet.meet_country,
              meet.meet_state,
              meet.sanctioned,
            );
            meetIds.set(
              meetKey(meet.federation_slug, meet.date, meet.meet_slug),
              Number(result.lastInsertRowid),
            );
          }

          const insertLift = db.prepare(`
            INSERT INTO lifts (
              lifter_id, meet_id, event, equipment, age, age_class, birth_year_class, division,
              bodyweight_kg, weight_class_kg,
              squat1_kg, squat2_kg, squat3_kg, squat4_kg,
              bench1_kg, bench2_kg, bench3_kg, bench4_kg,
              deadlift1_kg, deadlift2_kg, deadlift3_kg, deadlift4_kg,
              best3_squat_kg, best3_bench_kg, best3_deadlift_kg, total_kg,
              place_rank, place_status, dots, wilks, glossbrenner, goodlift, tested
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          let liftCount = 0;

          await pipeline(
            csvStreamFactory(),
            csvParser(),
            new Transform({
              objectMode: true,
              highWaterMark: LIFTS_BATCH_SIZE,
              transform(record: Record<string, string>, _enc, callback) {
                const lift = normalizeRow(record);
                if (lift == null) return callback();
                const lifterId = lifterIds.get(lift.lifter_slug);
                const meetId = meetIds.get(lift.meet_key);
                if (lifterId == null || meetId == null) return callback();
                callback(null, { lift, lifterId, meetId });
              },
            }),
            new Writable({
              objectMode: true,
              highWaterMark: LIFTS_BATCH_SIZE,
              write(payload: { lift: NormalizedLift; lifterId: number; meetId: number }, _enc, cb) {
                const { lift, lifterId, meetId } = payload;
                insertLift.run(
                  lifterId,
                  meetId,
                  lift.event,
                  lift.equipment,
                  lift.age,
                  lift.age_class,
                  lift.birth_year_class,
                  lift.division,
                  lift.bodyweight_kg,
                  lift.weight_class_kg,
                  lift.squat1_kg,
                  lift.squat2_kg,
                  lift.squat3_kg,
                  lift.squat4_kg,
                  lift.bench1_kg,
                  lift.bench2_kg,
                  lift.bench3_kg,
                  lift.bench4_kg,
                  lift.deadlift1_kg,
                  lift.deadlift2_kg,
                  lift.deadlift3_kg,
                  lift.deadlift4_kg,
                  lift.best3_squat_kg,
                  lift.best3_bench_kg,
                  lift.best3_deadlift_kg,
                  lift.total_kg,
                  lift.place_rank,
                  lift.place_status,
                  lift.dots,
                  lift.wilks,
                  lift.glossbrenner,
                  lift.goodlift,
                  lift.tested,
                );
                liftCount++;
                cb();
              },
            }),
          );

          stats.lifts = liftCount;

          db.exec("INSERT INTO lifters_fts(lifters_fts) VALUES('rebuild')");
          db.exec("INSERT INTO meets_fts(meets_fts) VALUES('rebuild')");
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      });

      const result: IngestResult = {
        status: "completed",
        stats,
        byteSize,
        durationMs: Date.now() - startedAt.getTime(),
        sourceLastModified,
      };
      await recordRun(startedAt, result);
      logger.info(
        `ingest: completed — ${stats.lifts} lifts in ${result.durationMs}ms (last-modified=${sourceLastModified ?? "n/a"})`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: IngestResult = {
        status: "failed",
        stats,
        byteSize,
        durationMs: Date.now() - startedAt.getTime(),
        sourceLastModified,
        error: message,
      };
      await recordRun(startedAt, result);
      logger.error(`ingest: failed: ${message}`);
      return result;
    }
  }

  async function downloadToTempFile(): Promise<{
    filePath: string;
    sourceLastModified: string | null;
    byteSize: number;
  }> {
    const response = await fetch(DOWNLOAD_URL);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download dataset: HTTP ${response.status}`);
    }
    const sourceLastModified = response.headers.get("last-modified");
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "opl-ingest-"));
    const filePath = path.join(tempDir, "opl.zip");
    await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(filePath));
    const stat = await fs.promises.stat(filePath);
    return { filePath, sourceLastModified, byteSize: stat.size };
  }

  async function findCsvEntryName(zipPath: string): Promise<string> {
    const directory = await unzipper.Open.file(zipPath);
    const csvEntry = directory.files.find(
      (file) => file.path.endsWith(".csv") && file.type === "File",
    );
    if (!csvEntry) throw new Error("Zip archive contains no CSV file");
    return csvEntry.path;
  }

  function csvStreamFactoryForZip(zipPath: string, csvEntryName: string): CsvStreamFactory {
    return () => {
      let stream: Readable | null = null;
      const proxy = new Readable({
        read() {},
      });
      void (async () => {
        try {
          const directory = await unzipper.Open.file(zipPath);
          const entry = directory.files.find((file) => file.path === csvEntryName);
          if (!entry) {
            proxy.destroy(new Error(`Zip entry not found: ${csvEntryName}`));
            return;
          }
          stream = entry.stream() as unknown as Readable;
          stream.on("data", (chunk) => {
            if (!proxy.push(chunk)) stream!.pause();
          });
          stream.on("end", () => proxy.push(null));
          stream.on("error", (err) => proxy.destroy(err));
          proxy.on("drain", () => stream?.resume());
        } catch (err) {
          proxy.destroy(err as Error);
        }
      })();
      return proxy;
    };
  }

  async function runNightly(options: { force?: boolean } = {}): Promise<IngestResult> {
    const startedAt = new Date();
    let downloadInfo: {
      filePath: string;
      sourceLastModified: string | null;
      byteSize: number;
    } | null = null;

    try {
      logger.info(`ingest: starting nightly run${options.force ? " (forced)" : ""}`);
      downloadInfo = await downloadToTempFile();

      const lastModified = downloadInfo.sourceLastModified;
      if (lastModified && !options.force) {
        const previous = await getLastSuccessfulSourceLastModified();
        if (previous && previous === lastModified) {
          logger.info(`ingest: source unchanged (last-modified=${lastModified}), skipping`);
          const result: IngestResult = {
            status: "skipped",
            stats: { federations: 0, lifters: 0, meets: 0, lifts: 0, skippedRows: 0 },
            byteSize: downloadInfo.byteSize,
            durationMs: Date.now() - startedAt.getTime(),
            sourceLastModified: lastModified,
          };
          await recordRun(startedAt, result);
          await fs.promises.rm(path.dirname(downloadInfo.filePath), {
            recursive: true,
            force: true,
          });
          return result;
        }
      }

      const csvEntryName = await findCsvEntryName(downloadInfo.filePath);
      const factory = csvStreamFactoryForZip(downloadInfo.filePath, csvEntryName);
      try {
        return await ingestFromStream(factory, {
          sourceLastModified: lastModified,
          byteSize: downloadInfo.byteSize,
        });
      } finally {
        await fs.promises.rm(path.dirname(downloadInfo.filePath), {
          recursive: true,
          force: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: IngestResult = {
        status: "failed",
        stats: { federations: 0, lifters: 0, meets: 0, lifts: 0, skippedRows: 0 },
        byteSize: downloadInfo?.byteSize ?? null,
        durationMs: Date.now() - startedAt.getTime(),
        sourceLastModified: downloadInfo?.sourceLastModified ?? null,
        error: message,
      };
      await recordRun(startedAt, result);
      logger.error(`ingest: failed: ${message}`);
      if (downloadInfo?.filePath) {
        await fs.promises
          .rm(path.dirname(downloadInfo.filePath), { recursive: true, force: true })
          .catch(() => {});
      }
      return result;
    }
  }

  return {
    runNightly,
    ingestFromStream,
  };
}
