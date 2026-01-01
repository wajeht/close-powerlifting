import path from "path";
import type { Knex } from "knex";
import { CustomMigrationSource } from "./migration-source";
import { config } from "../config";

const isTestEnv = process.env.NODE_ENV === "testing" || config.app.env === "testing";

export const knexConfig: Knex.Config = {
  client: "better-sqlite3",
  connection: {
    filename: isTestEnv ? ":memory:" : path.resolve(__dirname, "sqlite", "db.sqlite"),
  },
  useNullAsDefault: true,
  pool: {
    min: 0,
    max: 1,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    afterCreate: (conn: any, cb: (err: Error | null, conn: any) => void) => {
      // Enable WAL mode for better concurrency
      conn.pragma("journal_mode = WAL");
      // Set busy timeout to 2 minutes
      conn.pragma("busy_timeout = 120000");
      // Set cache size to 500MB
      conn.pragma("cache_size = -500000");
      // Set memory-mapped I/O to 1GB
      conn.pragma("mmap_size = 1073741824");
      // Set WAL autocheckpoint
      conn.pragma("wal_autocheckpoint = 4000");
      cb(null, conn);
    },
  },
  migrations: {
    tableName: "knex_migrations",
    migrationSource: new CustomMigrationSource(path.resolve(__dirname, "migrations")),
  },
  seeds: {
    directory: path.resolve(__dirname, "seeds"),
  },
  debug: false,
  log: isTestEnv
    ? { warn: () => {}, error: () => {}, debug: () => {}, deprecate: () => {} }
    : undefined,
};

export default knexConfig;
