import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import type { AppData } from "./types";
import {
  SQLITE_SNAPSHOT_FILENAME,
  createWritableDatabase,
  insertSqliteSnapshot,
  openReadonlyDatabase,
  readMetadata,
  type StoreMetadata,
} from "./sqlite";
import type { LoggerType } from "../utils/logger";

const SNAPSHOT_DIR = path.join(__dirname, "snapshot");
const SQLITE_FILE = path.join(SNAPSHOT_DIR, SQLITE_SNAPSHOT_FILENAME);

export interface LoadResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
}

export interface DataStoreType {
  load: () => Promise<LoadResult>;
  get: () => DatabaseSync;
  tryGet: () => StoreMetadata | null;
  getMetadata: () => StoreMetadata;
  set: (next: AppData) => void;
  reset: () => void;
}

let DB: DatabaseSync | null = null;
let METADATA: StoreMetadata | null = null;

export function createDataStore(logger: LoggerType): DataStoreType {
  function load(): Promise<LoadResult> {
    const startedAt = Date.now();

    if (!fs.existsSync(SQLITE_FILE)) {
      throw new Error(
        "sqlite snapshot not found. Run `npx tsx scripts/build-snapshot.ts` to build it locally, " +
          "or wait for the weekly GitHub Actions workflow to publish a fresh one.",
      );
    }

    closeCurrentDatabase();
    DB = openReadonlyDatabase(SQLITE_FILE);
    METADATA = readMetadata(DB);

    const durationMs = Date.now() - startedAt;
    logger.info(
      `sqlite store ready: ${METADATA.lifterCount} lifters, ${METADATA.meetCount} meets, ${METADATA.rowCount} entries in ${durationMs}ms (source last-modified=${METADATA.sourceLastModified ?? "unknown"}, built ${METADATA.ingestedAt})`,
    );

    return Promise.resolve({
      durationMs,
      sourceLastModified: METADATA.sourceLastModified,
      rowCount: METADATA.rowCount,
    });
  }

  function get(): DatabaseSync {
    if (DB == null) {
      throw new Error("SQLite store not ready - boot has not finished opening the snapshot");
    }
    return DB;
  }

  function tryGet(): StoreMetadata | null {
    return METADATA;
  }

  function getMetadata(): StoreMetadata {
    if (METADATA == null) {
      throw new Error("SQLite store not ready - boot has not finished opening the snapshot");
    }
    return METADATA;
  }

  function set(next: AppData): void {
    closeCurrentDatabase();
    const db = createWritableDatabase(":memory:");
    insertSqliteSnapshot(db, {
      lifters: next.lifters,
      meets: next.meets,
      entries: next.entries,
      bestEntryByLifter: next.bestEntryByLifter,
      rankByMetric: next.rankByMetric,
      records: next.records,
      federations: next.federations,
      sourceLastModified: next.sourceLastModified,
      builtAt: next.ingestedAt,
    });
    DB = db;
    METADATA = readMetadata(db);
  }

  function reset(): void {
    closeCurrentDatabase();
  }

  return { load, get, tryGet, getMetadata, set, reset };
}

function closeCurrentDatabase(): void {
  if (DB != null) DB.close();
  DB = null;
  METADATA = null;
}
