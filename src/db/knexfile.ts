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
      conn.pragma("synchronous = NORMAL"); // Good balance of speed and durability for WAL mode
      conn.pragma("busy_timeout = 30000"); // Wait up to 30 seconds if database is locked
      conn.pragma("cache_size = -64000"); // 64MB cache size (negative = KB)
      conn.pragma("temp_store = MEMORY"); // Store temp tables in memory
      conn.pragma("mmap_size = 0"); // Disable memory-mapped I/O to reduce memory usage
      conn.pragma("wal_autocheckpoint = 1000"); // Checkpoint every 1000 pages
      conn.pragma("foreign_keys = ON"); // Enforce foreign key constraints
      conn.pragma("page_size = 4096"); // 4KB page size
      conn.pragma("lock_timeout = 30000"); // Lock timeout matches busy_timeout
      conn.pragma("locking_mode = NORMAL"); // Allow concurrent access
      conn.pragma("optimize"); // Optimize query planner
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
