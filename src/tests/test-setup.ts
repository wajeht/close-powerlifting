process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import request from "supertest";
import { afterAll, beforeAll, vi } from "vitest";

import { createApp } from "../app";
import { createContext } from "../context";
import { createDatabase } from "../db/db";
import { createLogger } from "../utils/logger";

import {
  rankingsDefault,
  rankingsRawMen,
  rankingsRawWomen75,
  rankingsFullFilter,
} from "../routes/api/rankings/fixtures";
import { mlistHtml, mlistUsaplHtml } from "../routes/api/federations/fixtures";
import { statusHtml } from "../routes/api/status/fixtures";
import { userJohnHaackHtml } from "../routes/api/users/fixtures";
import { meetUspa1969Html } from "../routes/api/meets/fixtures";
import {
  recordsDefaultHtml,
  recordsRawHtml,
  recordsRawMenHtml,
} from "../routes/api/records/fixtures";

export const logger = createLogger();
logger.setLevel("SILENT");

const database = createDatabase(logger);
export const knex = database.instance;

const context = createContext();

vi.spyOn(context.scraper, "fetchJson").mockImplementation(async (path: string) => {
  if (path.includes("raw") && path.includes("women") && path.includes("75")) {
    return rankingsRawWomen75;
  }
  if (path.includes("raw") && path.includes("men")) {
    return rankingsRawMen;
  }
  if (path.includes("raw") && path.includes("women")) {
    return rankingsRawWomen75;
  }
  if (path.includes("raw")) {
    return rankingsRawMen;
  }
  if (path.includes("wraps")) {
    return rankingsDefault;
  }
  if (path.includes("rankings")) {
    return rankingsDefault;
  }
  throw new Error(`No fixture for JSON path: ${path}`);
});

vi.spyOn(context.scraper, "fetchHtml").mockImplementation(async (path: string) => {
  if (path.includes("status")) {
    return statusHtml;
  }
  if (path.includes("mlist") && path.includes("usapl")) {
    return mlistUsaplHtml;
  }
  if (path.includes("mlist") && !path.includes("nonexistent")) {
    return mlistHtml;
  }
  if (path.includes("johnhaack") || path.includes("search=haack")) {
    return userJohnHaackHtml;
  }
  if (path.includes("uspa/1969") || path.includes("m/uspa/1969")) {
    return meetUspa1969Html;
  }
  if (path.includes("records") && path.includes("raw") && path.includes("men")) {
    return recordsRawMenHtml;
  }
  if (path.includes("records") && path.includes("raw")) {
    return recordsRawHtml;
  }
  if (path.includes("records")) {
    return recordsDefaultHtml;
  }

  const { ScraperError } = await import("../error");
  throw new ScraperError(`Not found: ${path}`, 404, path);
});

export const { app } = createApp(context);

export let testApiKey: string;
let testUserId: number;

export function createUnauthenticatedSessionAgent() {
  return request.agent(app);
}

export function createAuthenticatedApiAgent() {
  return {
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${testApiKey}`),
    post: (url: string) => request(app).post(url).set("Authorization", `Bearer ${testApiKey}`),
    put: (url: string) => request(app).put(url).set("Authorization", `Bearer ${testApiKey}`),
    patch: (url: string) => request(app).patch(url).set("Authorization", `Bearer ${testApiKey}`),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${testApiKey}`),
  };
}

export function createUnauthenticatedApiAgent() {
  return {
    get: (url: string) => request(app).get(url),
    post: (url: string) => request(app).post(url),
    put: (url: string) => request(app).put(url),
    patch: (url: string) => request(app).patch(url),
    delete: (url: string) => request(app).delete(url),
  };
}

beforeAll(async () => {
  try {
    await knex.migrate.latest();
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }

  const { unhashedKey, hashedKey } = await context.helpers.generateAPIKey({
    userId: 999,
    name: "Test User",
    email: "test@example.com",
    admin: true,
  });

  testApiKey = unhashedKey;

  const existingUser = await knex("users").where({ email: "test@example.com" }).first();

  if (existingUser) {
    testUserId = existingUser.id;
    await knex("users").where({ id: existingUser.id }).update({ key: hashedKey });
  } else {
    const [user] = await knex("users")
      .insert({
        name: "Test User",
        email: "test@example.com",
        key: hashedKey,
        api_call_count: 0,
        api_call_limit: 500,
        admin: false,
      })
      .returning("*");
    testUserId = user.id;
  }
});

afterAll(async () => {
  try {
    if (testUserId) {
      await knex("users").where({ id: testUserId }).delete();
    }
    await knex.destroy();
  } catch (error) {
    console.error("Error cleaning up test database:", error);
    throw error;
  }
});
