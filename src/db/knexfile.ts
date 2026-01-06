import path from "path";
import type { Knex } from "knex";
import { CustomMigrationSource } from "./migration-source";

const isTesting = process.env.NODE_ENV === "testing" || process.env.APP_ENV === "testing";
const migrationsPath = path.resolve(__dirname, "migrations");

let knexConfig: Knex.Config = {
  client: "better-sqlite3",
  useNullAsDefault: true,
  connection: path.resolve(__dirname, "sqlite", "db.sqlite"),
  migrations: {
    tableName: "knex_migrations",
    migrationSource: new CustomMigrationSource(migrationsPath),
  },
  seeds: {
    directory: path.resolve(__dirname, "seeds"),
  },
  pool: {
    // WAL mode allows multiple concurrent readers, so increase pool size
    // for better read concurrency. Writes are still serialized by SQLite.
    min: 1,
    max: 4,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    afterCreate: (conn: any, cb: (err: Error | null, conn: any) => void) => {
      // SQLite performance optimizations
      // See: https://sqlite.org/pragma.html
      conn.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrency
      conn.pragma("busy_timeout = 120000"); // Wait up to 2 minutes if database is locked
      conn.pragma("cache_size = -500000"); // 500MB cache size (negative = KB)
      conn.pragma("mmap_size = 1073741824"); // 1GB memory-mapped I/O
      conn.pragma("wal_autocheckpoint = 4000"); // Checkpoint every 4000 pages
      conn.pragma("synchronous = NORMAL"); // Good balance of speed and durability for WAL mode
      conn.pragma("temp_store = MEMORY"); // Store temp tables in memory
      conn.pragma("foreign_keys = ON"); // Enforce foreign key constraints
      cb(null, conn);
    },
  },
};

if (isTesting) {
  knexConfig = {
    ...knexConfig,
    connection: {
      filename: ":memory:",
    },
    log: {
      warn: () => {},
      error: () => {},
      debug: () => {},
      deprecate: () => {},
    },
  };
}

export { knexConfig };
export default knexConfig;
