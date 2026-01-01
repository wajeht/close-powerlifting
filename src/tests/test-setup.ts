process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import { beforeAll, afterAll } from "vitest";
import { getDb, stopDatabase } from "../db/db";

beforeAll(async () => {
  try {
    const db = getDb();
    await db.migrate.latest();
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await stopDatabase();
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
});
