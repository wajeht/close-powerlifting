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
    min: 0,
    max: 1,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    afterCreate: (conn: any, cb: (err: Error | null, conn: any) => void) => {
      conn.pragma("journal_mode = WAL");
      conn.pragma("busy_timeout = 120000");
      conn.pragma("cache_size = -500000");
      conn.pragma("mmap_size = 1073741824");
      conn.pragma("wal_autocheckpoint = 4000");
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
