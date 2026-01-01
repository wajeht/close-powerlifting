process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import { beforeAll, afterAll } from "vitest";
import { getDb, stop } from "../db/db";

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
    await stop();
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
});
