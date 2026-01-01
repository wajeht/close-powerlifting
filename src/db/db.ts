import knex, { Knex } from "knex";
import { knexConfig } from "./knexfile";
import { logger } from "../utils/logger";

let db: Knex;

export function getDb(): Knex {
  if (!db) {
    db = knex(knexConfig);
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  try {
    db = getDb();
    await db.migrate.latest();
    logger.info("Database connection established and migrations applied!");
  } catch (error) {
    logger.error("Database initialization failed!");
    console.error(error);
    throw error;
  }
}

export async function stopDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    logger.info("Database connection closed!");
  }
}
