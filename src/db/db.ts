import knex, { Knex } from "knex";
import { knexConfig } from "./knexfile";
import type { LoggerType } from "../utils/logger";

let _db: Knex | null = null;

function _createKnexInstance(): Knex {
  if (_db) {
    return _db;
  }
  _db = knex(knexConfig);
  return _db;
}

export interface DatabaseType {
  instance: Knex;
  init: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createDatabase(logger: LoggerType): DatabaseType {
  const knexInstance = _createKnexInstance();

  async function init(): Promise<void> {
    try {
      await knexInstance.migrate.latest();
      logger.info("Database connection established and migrations applied!");
    } catch (error) {
      logger.error("Database initialization failed!");
      console.error(error);
      throw error;
    }
  }

  async function stop(): Promise<void> {
    if (_db) {
      await _db.destroy();
      _db = null;
      logger.info("Database connection closed!");
    }
  }

  return {
    instance: knexInstance,
    init,
    stop,
  };
}
