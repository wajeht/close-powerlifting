// Nightly ingest of the OpenPowerlifting CSV dump into our normalized SQLite
// schema (federations, lifters, meets, lifts).
//
// Whole import runs inside ONE manual BEGIN/COMMIT — atomic. Any failure
// ROLLBACKs and leaves the previous data set untouched. We never buffer rows;
// backpressure flows through pipeline() down to the CSV parser, so memory is
// bounded regardless of input size.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, type Transform } from "node:stream";
import type { Knex } from "knex";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import type { LoggerType } from "./logger";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
const REGEX_DIACRITICS = /\p{Mn}/gu;

// SQLite PRAGMAs applied to the ingest connection only. Reverted to the
// steady-state values (matching src/db/knexfile.ts `afterCreate`) in a
// `finally` block before the connection is returned to the knex pool, so
// read traffic sees the normal serving config.
const INGEST_PRAGMAS: ReadonlyArray<string> = [
  // Big page cache so dirty pages stay in RAM through the import instead of
  // spilling to the WAL on every flush.
  "PRAGMA cache_size = -524288",
  // mmap lets the OS pagecache serve b-tree lookups without copying through
  // SQLite's own cache.
  "PRAGMA mmap_size = 268435456",
  // Don't auto-checkpoint mid-transaction. We do one explicit
  // `wal_checkpoint(TRUNCATE)` after COMMIT.
  "PRAGMA wal_autocheckpoint = 0",
  // Keep dirty pages in cache through the txn — don't flush opportunistically.
  "PRAGMA cache_spill = OFF",
  // Hold the file lock for the duration of the connection. Skips per-statement
  // lock syscalls. Safe because the nightly cron is the only writer.
  "PRAGMA locking_mode = EXCLUSIVE",
];

const STEADY_STATE_PRAGMAS: ReadonlyArray<string> = [
  "PRAGMA cache_size = -64000",
  "PRAGMA mmap_size = 0",
  "PRAGMA wal_autocheckpoint = 1000",
  "PRAGMA cache_spill = ON",
  "PRAGMA locking_mode = NORMAL",
];
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;
const REGEX_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_PLACE_NUMERIC = /^\d+$/;

// Stable URL-safe identifier for a lifter / federation / meet. NFKD + diacritic
// strip means "Māris Rāzmanis" and "Maris Razmanis" collapse to the same slug,
// matching what OpenPowerlifting itself does on their site URLs.
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

// OPL's `Place` column is overloaded: a number means finishing rank, a code
// (DQ / DD / NS / G / etc.) means non-finishing status. We split into two
// columns so SQL queries can filter on either without parsing strings.
function splitPlace(value: string | undefined): PlaceSplit {
  const text = trimToNull(value);
  if (text == null) return { rank: null, status: null };
  if (REGEX_PLACE_NUMERIC.test(text)) {
    return { rank: parseInt(text, 10), status: null };
  }
  return { rank: null, status: text };
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

// The OPL CSV has no stable meet id, but (federation, date, meet name) is
// unique enough in practice. We hash these three together to dedup meets
// across the millions of lift rows that reference them.
function meetKey(federationSlug: string, date: string, meetSlug: string): string {
  return `${federationSlug}|${date}|${meetSlug}`;
}

// Names of every CSV column normalizeRow + the streaming loop touch. The
// header row of each ingest is validated against this list so we fail fast
// if OpenPowerlifting renames a column instead of silently writing nulls.
const REQUIRED_COLUMNS = [
  "Name",
  "Sex",
  "Event",
  "Equipment",
  "Age",
  "AgeClass",
  "BirthYearClass",
  "Division",
  "BodyweightKg",
  "WeightClassKg",
  "Squat1Kg",
  "Squat2Kg",
  "Squat3Kg",
  "Squat4Kg",
  "Bench1Kg",
  "Bench2Kg",
  "Bench3Kg",
  "Bench4Kg",
  "Deadlift1Kg",
  "Deadlift2Kg",
  "Deadlift3Kg",
  "Deadlift4Kg",
  "Best3SquatKg",
  "Best3BenchKg",
  "Best3DeadliftKg",
  "TotalKg",
  "Place",
  "Dots",
  "Wilks",
  "Glossbrenner",
  "Goodlift",
  "Tested",
  "Country",
  "State",
  "Federation",
  "ParentFederation",
  "Date",
  "MeetCountry",
  "MeetState",
  "MeetName",
  "Sanctioned",
] as const;

type ColumnName = (typeof REQUIRED_COLUMNS)[number];
type ColumnIndex = Record<ColumnName, number>;

function buildColumnIndex(header: string[]): ColumnIndex {
  const lookup: Partial<ColumnIndex> = {};
  for (const name of REQUIRED_COLUMNS) {
    const idx = header.indexOf(name);
    if (idx === -1) {
      throw new Error(`CSV header missing required column: ${name}`);
    }
    lookup[name] = idx;
  }
  return lookup as ColumnIndex;
}

// Converts one CSV row into the shape we want to write. Returns null for
// unusable rows (missing required fields, bad date format, etc.); the caller
// counts those as `skippedRows` rather than aborting the whole import.
// `row` is a positional string[] (not an object) — see csvParser() for why.
function normalizeRow(row: string[], col: ColumnIndex): NormalizedLift | null {
  const name = trimToNull(row[col.Name]);
  const date = trimToNull(row[col.Date]);
  const event = trimToNull(row[col.Event]);
  const equipment = trimToNull(row[col.Equipment]);
  const federation = trimToNull(row[col.Federation]);
  if (!name || !date || !event || !equipment || !federation) return null;
  if (!REGEX_ISO_DATE.test(date)) return null;

  const meetName = trimToNull(row[col.MeetName]);
  if (!meetName) return null;

  const place = splitPlace(row[col.Place]);
  const federationSlug = nameToSlug(federation);
  const meetSlug = nameToSlug(meetName);

  return {
    lifter_slug: nameToSlug(name),
    meet_key: meetKey(federationSlug, date, meetSlug),
    event,
    equipment,
    age: toNumber(row[col.Age]),
    age_class: trimToNull(row[col.AgeClass]),
    birth_year_class: trimToNull(row[col.BirthYearClass]),
    division: trimToNull(row[col.Division]),
    bodyweight_kg: toNumber(row[col.BodyweightKg]),
    weight_class_kg: toNumber(row[col.WeightClassKg]),
    squat1_kg: toNumber(row[col.Squat1Kg]),
    squat2_kg: toNumber(row[col.Squat2Kg]),
    squat3_kg: toNumber(row[col.Squat3Kg]),
    squat4_kg: toNumber(row[col.Squat4Kg]),
    bench1_kg: toNumber(row[col.Bench1Kg]),
    bench2_kg: toNumber(row[col.Bench2Kg]),
    bench3_kg: toNumber(row[col.Bench3Kg]),
    bench4_kg: toNumber(row[col.Bench4Kg]),
    deadlift1_kg: toNumber(row[col.Deadlift1Kg]),
    deadlift2_kg: toNumber(row[col.Deadlift2Kg]),
    deadlift3_kg: toNumber(row[col.Deadlift3Kg]),
    deadlift4_kg: toNumber(row[col.Deadlift4Kg]),
    best3_squat_kg: toNumber(row[col.Best3SquatKg]),
    best3_bench_kg: toNumber(row[col.Best3BenchKg]),
    best3_deadlift_kg: toNumber(row[col.Best3DeadliftKg]),
    total_kg: toNumber(row[col.TotalKg]),
    place_rank: place.rank,
    place_status: place.status,
    dots: toNumber(row[col.Dots]),
    wilks: toNumber(row[col.Wilks]),
    glossbrenner: toNumber(row[col.Glossbrenner]),
    goodlift: toNumber(row[col.Goodlift]),
    tested: toBool(row[col.Tested]),
  };
}

export function createIngestService(knex: Knex, logger: LoggerType): IngestServiceType {
  interface KnexClient {
    acquireConnection: () => Promise<BetterSqliteDatabase>;
    releaseConnection: (conn: BetterSqliteDatabase) => Promise<void>;
  }

  // We need direct access to the raw `better-sqlite3` handle (not knex's query
  // builder) so we can use prepared statements and a manual BEGIN/COMMIT.
  // Acquiring + releasing a pooled connection via the knex client API keeps
  // the rest of the app's connection lifecycle intact.
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

  // `columns: false` emits string[] per row instead of allocating a fresh
  // {Name, Date, ...} object each row — drops a ton of GC pressure on a long
  // ingest. The header is consumed as the first row of the stream and used to
  // build a `ColumnIndex` (see buildColumnIndex) so we keep access by name.
  function csvParser(): Transform {
    return parseCsv({ columns: false, skip_empty_lines: true, relax_column_count: true });
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
      // Single pass — stream the CSV once, lazily inserting federation/lifter/meet
      // dimensions the first time they're seen, then immediately inserting the
      // lift row with the resolved foreign keys. Everything runs inside one
      // transaction; ROLLBACK on any error leaves the prior DB state intact.
      await withDb(async (db) => {
        for (const pragma of INGEST_PRAGMAS) db.exec(pragma);
        try {
          // Manual BEGIN/COMMIT (instead of better-sqlite3's `db.transaction()`)
          // because the streaming pipeline below is async — db.transaction()
          // requires a synchronous body.
          db.exec("BEGIN");
          // Skip FK validation on every lift INSERT; SQLite checks at COMMIT
          // instead. We resolve FK ids in JS Maps so they're always correct,
          // and the deferred check catches any bug in that logic atomically.
          db.exec("PRAGMA defer_foreign_keys = ON");
          try {
            // Order matters: child tables before parents (FK constraints).
            // Wiping inside the txn means readers still see the previous data
            // until COMMIT swaps it in.
            db.exec("DELETE FROM lifts");
            db.exec("DELETE FROM meets");
            db.exec("DELETE FROM lifters");
            db.exec("DELETE FROM federations");

            // Drop secondary indexes on lifts so each INSERT only touches the
            // primary key. We CREATE INDEX once after the bulk load below, which
            // is dramatically faster than maintaining four b-trees per row.
            db.exec("DROP INDEX IF EXISTS idx_lifts_lifter");
            db.exec("DROP INDEX IF EXISTS idx_lifts_meet");
            db.exec("DROP INDEX IF EXISTS idx_lifts_rankings_total");
            db.exec("DROP INDEX IF EXISTS idx_lifts_rankings_dots");

            // FK lookup tables. The id comes from `lastInsertRowid` the first
            // time we INSERT each dimension; every subsequent lift reuses it.
            const federationIds = new Map<string, number>();
            const lifterIds = new Map<string, number>();
            const meetIds = new Map<string, number>();

            const insertFederation = db.prepare(
              "INSERT INTO federations (slug, code, parent_slug) VALUES (?, ?, ?)",
            );
            const insertLifter = db.prepare(
              "INSERT INTO lifters (name, name_slug, sex, country, state) VALUES (?, ?, ?, ?, ?)",
            );
            const insertMeet = db.prepare(
              "INSERT INTO meets (federation_id, date, meet_name, meet_slug, meet_country, meet_state, sanctioned) VALUES (?, ?, ?, ?, ?, ?, ?)",
            );
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

            let col: ColumnIndex | null = null;

            // pipeline() propagates backpressure end-to-end: when the SQLite
            // write side falls behind, the CSV parser pauses, and ultimately
            // the zip read pauses too. The terminal sink is a plain async
            // function — same backpressure as a Writable, no callback noise.
            await pipeline(
              csvStreamFactory(),
              csvParser(),
              async function (source: AsyncIterable<string[]>) {
                for await (const row of source) {
                  if (col == null) {
                    col = buildColumnIndex(row);
                    continue;
                  }

                  const lift = normalizeRow(row, col);
                  if (lift == null) {
                    stats.skippedRows++;
                    continue;
                  }

                  // Lazy dimension insert: the first time we see a federation /
                  // lifter / meet, INSERT it now and cache the returned id.
                  // Safe because we're inside one transaction — if the import
                  // fails halfway, ROLLBACK undoes the partial dimensions too.

                  const federationCode = row[col.Federation]!.trim();
                  const federationSlug = nameToSlug(federationCode);
                  let federationId = federationIds.get(federationSlug);
                  if (federationId == null) {
                    const parent = trimToNull(row[col.ParentFederation]);
                    const result = insertFederation.run(
                      federationSlug,
                      federationCode,
                      parent ? nameToSlug(parent) : null,
                    );
                    federationId = Number(result.lastInsertRowid);
                    federationIds.set(federationSlug, federationId);
                  }

                  let lifterId = lifterIds.get(lift.lifter_slug);
                  if (lifterId == null) {
                    const result = insertLifter.run(
                      row[col.Name]!.trim(),
                      lift.lifter_slug,
                      trimToNull(row[col.Sex]),
                      trimToNull(row[col.Country]),
                      trimToNull(row[col.State]),
                    );
                    lifterId = Number(result.lastInsertRowid);
                    lifterIds.set(lift.lifter_slug, lifterId);
                  }

                  let meetId = meetIds.get(lift.meet_key);
                  if (meetId == null) {
                    const meetNameRaw = row[col.MeetName]!.trim();
                    const result = insertMeet.run(
                      federationId,
                      row[col.Date]!.trim(),
                      meetNameRaw,
                      nameToSlug(meetNameRaw),
                      trimToNull(row[col.MeetCountry]),
                      trimToNull(row[col.MeetState]),
                      toBool(row[col.Sanctioned]),
                    );
                    meetId = Number(result.lastInsertRowid);
                    meetIds.set(lift.meet_key, meetId);
                  }

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
                  stats.lifts++;
                }
              },
            );

            stats.federations = federationIds.size;
            stats.lifters = lifterIds.size;
            stats.meets = meetIds.size;

            // Rebuild secondary indexes now that all rows are in. CREATE INDEX
            // does a single sequential scan + sort, way faster than 3.9M
            // incremental b-tree inserts. Must match the index definitions in
            // the migration (20260518000000_create_powerlifting_tables.ts).
            db.exec("CREATE INDEX idx_lifts_lifter ON lifts(lifter_id)");
            db.exec("CREATE INDEX idx_lifts_meet ON lifts(meet_id)");
            db.exec(
              "CREATE INDEX idx_lifts_rankings_total ON lifts(event, equipment, weight_class_kg, total_kg)",
            );
            db.exec("CREATE INDEX idx_lifts_rankings_dots ON lifts(event, equipment, dots)");

            // FTS5 'rebuild' is the documented optimal way to populate
            // external-content FTS tables — does one big scan-and-build instead
            // of triggering on every row insert.
            db.exec("INSERT INTO lifters_fts(lifters_fts) VALUES('rebuild')");
            db.exec("INSERT INTO meets_fts(meets_fts) VALUES('rebuild')");
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          // After the big commit, TRUNCATE the WAL so the next reader doesn't
          // have to do an auto-checkpoint of however many GB we just wrote.
          db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
          // Refresh the query planner's stats now that row counts changed
          // dramatically — keeps SELECT plans reasonable for serving traffic.
          db.exec("PRAGMA optimize");
        } finally {
          // ALWAYS reset to steady-state, even on error. Otherwise this
          // connection goes back into the knex pool with EXCLUSIVE locking
          // mode + 512 MB cache, which would break read traffic.
          for (const pragma of STEADY_STATE_PRAGMAS) db.exec(pragma);
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

  // Returns a factory the ingest pipeline can call to get a fresh stream over
  // the CSV inside the zip. Implemented as a proxy Readable that lazily opens
  // the zip + entry. Backpressure is propagated by pausing/resuming the
  // underlying unzipper stream when the proxy's internal buffer fills.
  //
  // Why a factory at all (instead of just a stream): keeps the API symmetric
  // with how tests work (they can pass `() => Readable.from(buffer)`) and
  // future-proof for any pass that needs to re-read.
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

      // Cheap dedup: if the upstream Last-Modified header matches the last
      // successful run, the CSV is byte-identical to what we already have.
      // Skip the (expensive) parse + reload entirely; record the run as
      // "skipped" so the audit log is honest about why nothing changed.
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
