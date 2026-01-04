process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import { beforeAll, afterAll } from "vitest";
import { createDatabase } from "../db/db";
import { createLogger } from "../utils/logger";

const logger = createLogger();
logger.setLevel("SILENT");

const database = createDatabase(logger);
export const db = database.instance;

beforeAll(async () => {
  try {
    await db.migrate.latest();
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await db.destroy();
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
});
