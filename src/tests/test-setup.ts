process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import { beforeAll, afterAll } from "vitest";
import { Database } from "../db/db";

beforeAll(async () => {
  try {
    const database = Database();
    await database.init();
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
});

afterAll(async () => {
  try {
    const database = Database();
    await database.stop();
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
});
