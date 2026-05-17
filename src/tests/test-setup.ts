process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import request from "supertest";
import { afterAll, beforeAll, vi } from "vite-plus/test";

import { createApp } from "../app";
import { createContext } from "../context";
import { createDatabase } from "../db/db";
import { createLogger } from "../utils/logger";

export const logger = createLogger();
logger.setLevel("SILENT");

const database = createDatabase(logger);
export const knex = database.instance;

const context = createContext();

vi.spyOn(context.mail, "sendVerificationEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendMagicLinkEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendEmailChangeVerificationEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendWelcomeEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendContactEmail").mockResolvedValue();
vi.spyOn(context.mail, "verifyConnection").mockResolvedValue(true);

export const { app } = await createApp(context);

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

export function extractCsrfToken(html: string): string {
  const match = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!match) {
    throw new Error("CSRF token not found in response");
  }
  return match[1];
}

beforeAll(async () => {
  try {
    await knex.migrate.latest();
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }

  const { seedLifts } = await import("./lifts-fixtures");
  await seedLifts(knex);

  const existingUser = await knex("users").where({ email: "test@example.com" }).first();

  if (existingUser) {
    testUserId = existingUser.id;
  } else {
    const [user] = await knex("users")
      .insert({
        name: "Test User",
        email: "test@example.com",
        api_key_version: 1,
        admin: false,
      })
      .returning("*");
    testUserId = user.id;
  }

  testApiKey = context.authService.generateKey({
    userId: String(testUserId),
    name: "Test User",
    email: "test@example.com",
    apiKeyVersion: 1,
    admin: true,
  });

  await knex("users").where({ id: testUserId }).update({
    api_key: testApiKey,
    api_key_version: 1,
  });
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
