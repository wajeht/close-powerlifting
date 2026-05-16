import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { Knex } from "knex";

import { parse as parseCsv } from "csv-parse";
import unzipper from "unzipper";

import type { LoggerType } from "./logger";

const DOWNLOAD_URL = "https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip";
// SQLite caps bound parameters at ~32,766. With 41 columns per row, we keep
// (BATCH_SIZE * columns) comfortably under that ceiling.
const BATCH_SIZE = 500;

const CSV_COLUMNS = [
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

const REGEX_DIACRITICS = /\p{Mn}/gu;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;

export function nameToSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(REGEX_DIACRITICS, "")
    .toLowerCase()
    .replace(REGEX_SLUG_STRIP, "");
}

interface LiftRow {
  name: string;
  name_slug: string;
  sex: string | null;
  event: string | null;
  equipment: string | null;
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
  place: string | null;
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
  tested: string | null;
  country: string | null;
  state: string | null;
  federation: string | null;
  parent_federation: string | null;
  date: string;
  meet_country: string | null;
  meet_state: string | null;
  meet_name: string | null;
  sanctioned: string | null;
}

function text(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function numeric(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowFromCsv(record: Record<string, string>): LiftRow | null {
  const name = text(record.Name);
  const date = text(record.Date);
  if (!name || !date) return null;

  return {
    name,
    name_slug: nameToSlug(name),
    sex: text(record.Sex),
    event: text(record.Event),
    equipment: text(record.Equipment),
    age: numeric(record.Age),
    age_class: text(record.AgeClass),
    birth_year_class: text(record.BirthYearClass),
    division: text(record.Division),
    bodyweight_kg: numeric(record.BodyweightKg),
    weight_class_kg: numeric(record.WeightClassKg),
    squat1_kg: numeric(record.Squat1Kg),
    squat2_kg: numeric(record.Squat2Kg),
    squat3_kg: numeric(record.Squat3Kg),
    squat4_kg: numeric(record.Squat4Kg),
    bench1_kg: numeric(record.Bench1Kg),
    bench2_kg: numeric(record.Bench2Kg),
    bench3_kg: numeric(record.Bench3Kg),
    bench4_kg: numeric(record.Bench4Kg),
    deadlift1_kg: numeric(record.Deadlift1Kg),
    deadlift2_kg: numeric(record.Deadlift2Kg),
    deadlift3_kg: numeric(record.Deadlift3Kg),
    deadlift4_kg: numeric(record.Deadlift4Kg),
    best3_squat_kg: numeric(record.Best3SquatKg),
    best3_bench_kg: numeric(record.Best3BenchKg),
    best3_deadlift_kg: numeric(record.Best3DeadliftKg),
    total_kg: numeric(record.TotalKg),
    place: text(record.Place),
    dots: numeric(record.Dots),
    wilks: numeric(record.Wilks),
    glossbrenner: numeric(record.Glossbrenner),
    goodlift: numeric(record.Goodlift),
    tested: text(record.Tested),
    country: text(record.Country),
    state: text(record.State),
    federation: text(record.Federation),
    parent_federation: text(record.ParentFederation),
    date,
    meet_country: text(record.MeetCountry),
    meet_state: text(record.MeetState),
    meet_name: text(record.MeetName),
    sanctioned: text(record.Sanctioned),
  };
}

export interface IngestResult {
  status: "completed" | "skipped" | "failed";
  rowCount: number;
  byteSize: number | null;
  durationMs: number;
  sourceLastModified: string | null;
  error?: string;
}

export interface IngestServiceType {
  runNightly: (options?: { force?: boolean }) => Promise<IngestResult>;
  ingestFromStream: (
    csvStream: Readable,
    options?: { sourceLastModified?: string | null; byteSize?: number | null },
  ) => Promise<IngestResult>;
}

export function createIngestService(knex: Knex, logger: LoggerType): IngestServiceType {
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
      row_count: result.rowCount,
      byte_size: result.byteSize,
      source_last_modified: result.sourceLastModified,
      status: result.status,
      error: result.error ?? null,
    });
  }

  async function ingestFromStream(
    csvStream: Readable,
    options: { sourceLastModified?: string | null; byteSize?: number | null } = {},
  ): Promise<IngestResult> {
    const startedAt = new Date();
    const sourceLastModified = options.sourceLastModified ?? null;
    const byteSize = options.byteSize ?? null;
    let rowCount = 0;

    const parser = csvStream.pipe(
      parseCsv({
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      }),
    );

    let batch: LiftRow[] = [];

    async function flushBatch(trx: Knex.Transaction): Promise<void> {
      if (batch.length === 0) return;
      await trx("lifts").insert(batch);
      batch = [];
    }

    try {
      await knex.transaction(async (trx) => {
        await trx("lifts").delete();

        for await (const record of parser as AsyncIterable<Record<string, string>>) {
          const row = rowFromCsv(record);
          if (!row) continue;
          batch.push(row);
          rowCount++;
          if (batch.length >= BATCH_SIZE) {
            await flushBatch(trx);
          }
        }

        await flushBatch(trx);

        await trx.raw("INSERT INTO lifts_fts(lifts_fts) VALUES('rebuild')");
      });

      const result: IngestResult = {
        status: "completed",
        rowCount,
        byteSize,
        durationMs: Date.now() - startedAt.getTime(),
        sourceLastModified,
      };
      await recordRun(startedAt, result);
      logger.info(
        `ingest: completed (${rowCount} rows, ${result.durationMs}ms, last-modified=${sourceLastModified ?? "n/a"})`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: IngestResult = {
        status: "failed",
        rowCount,
        byteSize,
        durationMs: Date.now() - startedAt.getTime(),
        sourceLastModified,
        error: message,
      };
      await recordRun(startedAt, result);
      logger.error(`ingest: failed after ${rowCount} rows: ${message}`);
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
    const fileStream = fs.createWriteStream(filePath);

    await pipeline(Readable.fromWeb(response.body as never), fileStream);
    const stat = await fs.promises.stat(filePath);

    return { filePath, sourceLastModified, byteSize: stat.size };
  }

  async function findCsvEntry(
    zipPath: string,
  ): Promise<{ stream: Readable; cleanup: () => Promise<void> }> {
    const directory = await unzipper.Open.file(zipPath);
    const csvEntry = directory.files.find(
      (file) => file.path.endsWith(".csv") && file.type === "File",
    );
    if (!csvEntry) {
      throw new Error("Zip archive contains no CSV file");
    }

    const stream = csvEntry.stream();

    async function cleanup(): Promise<void> {
      try {
        await fs.promises.rm(path.dirname(zipPath), { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }

    return { stream: stream as unknown as Readable, cleanup };
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
            rowCount: 0,
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

      const { stream, cleanup } = await findCsvEntry(downloadInfo.filePath);
      try {
        return await ingestFromStream(stream, {
          sourceLastModified: lastModified,
          byteSize: downloadInfo.byteSize,
        });
      } finally {
        await cleanup();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: IngestResult = {
        status: "failed",
        rowCount: 0,
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

export const __test_only__ = {
  CSV_COLUMNS,
  rowFromCsv,
};
