import fs from "node:fs";
import path from "node:path";

import createKnex, { type Knex } from "knex";

import type { LoggerType } from "../utils/logger";

const DATABASE_DIR = path.join(__dirname, "snapshot");
const DATABASE_FILE = path.join(DATABASE_DIR, "close-powerlifting.sqlite");
const EXPECTED_SCHEMA_VERSION = 1;

export interface SnapshotMetadata {
  schemaVersion: number;
  sourceLastModified: string | null;
  builtAt: string;
  lifters: number;
  meets: number;
  entries: number;
  federations: number;
  records: number;
}

export interface DatabaseState {
  db: Knex;
  metadata: SnapshotMetadata;
}

export interface LoadResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
}

export interface DataStoreType {
  load: () => Promise<LoadResult>;
  get: () => DatabaseState;
  tryGet: () => DatabaseState | null;
  set: (next: DatabaseState) => void;
  reset: () => void;
}

export function createDataStore(logger: LoggerType): DataStoreType {
  let state: DatabaseState | null = null;

  async function load(): Promise<LoadResult> {
    const startedAt = Date.now();
    if (!fs.existsSync(DATABASE_FILE)) {
      throw new Error(
        "SQLite snapshot not found. Run `npm run database:build` locally, " +
          "or download the published close-powerlifting.sqlite release asset.",
      );
    }

    const db = createDatabaseClient(DATABASE_FILE, true);
    try {
      const metadata = await readMetadata(db);
      if (metadata.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
        throw new Error(
          `SQLite snapshot schema ${metadata.schemaVersion} is not supported; expected ${EXPECTED_SCHEMA_VERSION}`,
        );
      }

      state = { db, metadata };
      const durationMs = Date.now() - startedAt;
      logger.info(
        `database ready: ${metadata.lifters} lifters, ${metadata.meets} meets, ${metadata.entries} entries in ${durationMs}ms (source last-modified=${metadata.sourceLastModified ?? "unknown"}, built ${metadata.builtAt})`,
      );
      return {
        durationMs,
        sourceLastModified: metadata.sourceLastModified,
        rowCount: metadata.entries,
      };
    } catch (error) {
      await db.destroy();
      throw error;
    }
  }

  function get(): DatabaseState {
    if (state == null) {
      throw new Error("SQLite snapshot not ready - boot has not opened the database");
    }
    return state;
  }

  function tryGet(): DatabaseState | null {
    return state;
  }

  function set(next: DatabaseState): void {
    void state?.db.destroy().catch(() => undefined);
    state = next;
  }

  function reset(): void {
    void state?.db.destroy().catch(() => undefined);
    state = null;
  }

  return { load, get, tryGet, set, reset };
}

export function createDatabaseClient(filename: string, readonly: boolean): Knex {
  return createKnex({
    client: "better-sqlite3",
    connection: {
      filename,
      options: { readonly },
    },
    pool: {
      min: 1,
      max: 1,
    },
    useNullAsDefault: true,
  });
}

async function readMetadata(db: Knex): Promise<SnapshotMetadata> {
  const rows = await db<{ key: string; value: string }>("metadata").select("key", "value");
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    schemaVersion: numberMetadata(values, "schema_version"),
    sourceLastModified: nullableMetadata(values, "source_last_modified"),
    builtAt: stringMetadata(values, "built_at"),
    lifters: numberMetadata(values, "lifters"),
    meets: numberMetadata(values, "meets"),
    entries: numberMetadata(values, "entries"),
    federations: numberMetadata(values, "federations"),
    records: numberMetadata(values, "records"),
  };
}

function stringMetadata(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (value == null || value.length === 0) {
    throw new Error(`SQLite snapshot metadata is missing ${key}`);
  }
  return value;
}

function nullableMetadata(values: Map<string, string>, key: string): string | null {
  const value = values.get(key);
  return value == null || value.length === 0 ? null : value;
}

function numberMetadata(values: Map<string, string>, key: string): number {
  const value = stringMetadata(values, key);
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`SQLite snapshot metadata ${key} is not a number`);
  }
  return parsed;
}
