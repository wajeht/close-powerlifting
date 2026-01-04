process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import request from "supertest";
import { afterAll, beforeAll } from "vitest";

import { createApp } from "../app";
import { createContext } from "../context";
import { createDatabase } from "../db/db";
import { createLogger } from "../utils/logger";

const logger = createLogger();
logger.setLevel("SILENT");

const database = createDatabase(logger);
export const knex = database.instance;

const context = createContext();
export const { app } = createApp(context);

export let testApiKey: string;
let testUserId: number;

export function authenticatedRequest() {
  return {
    get: (url: string) => request(app).get(url).set("x-api-key", testApiKey),
    post: (url: string) => request(app).post(url).set("x-api-key", testApiKey),
    put: (url: string) => request(app).put(url).set("x-api-key", testApiKey),
    patch: (url: string) => request(app).patch(url).set("x-api-key", testApiKey),
    delete: (url: string) => request(app).delete(url).set("x-api-key", testApiKey),
  };
}

export function unauthenticatedRequest() {
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
