process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import request from "supertest";
import { afterAll, beforeAll, vi } from "vite-plus/test";

import { createApp } from "../app";
import { createContext } from "../context";
import { createDatabase } from "../db/db";
import { createLogger } from "../utils/logger";

import {
  rankingsDefault,
  rankingsDefaultKg,
  rankingsRawMen,
  rankingsRawWomen75,
  rankingsFullFilter,
} from "../routes/api/rankings/fixtures";
import { mlistHtml, mlistUsaplHtml } from "../routes/api/federations/fixtures";
import { statusHtml } from "../routes/api/status/fixtures";
import {
  userJohnHaackHtml,
  userJohnHaackKgHtml,
  userKristyHawkinsHtml,
} from "../routes/api/users/fixtures";
import {
  meetUspa1969Html,
  meetUspa1969ByWilksHtml,
  meetUspa1969ByTotalHtml,
  meetUspa1969KgHtml,
} from "../routes/api/meets/fixtures";
import {
  recordsDefaultHtml,
  recordsRawHtml,
  recordsWrapsHtml,
  recordsSingleHtml,
  recordsMultiHtml,
  recordsUnlimitedHtml,
  recordsAllTestedHtml,
  recordsRawMenHtml,
  recordsRawWomenHtml,
  recordsUnlimitedWpClassesHtml,
  recordsRawIpfClassesHtml,
  recordsRawExpandedClassesHtml,
  recordsUnlimitedWpClassesWomenHtml,
  recordsRawIpfClassesMenHtml,
} from "../routes/api/records/fixtures";

export const logger = createLogger();
logger.setLevel("SILENT");

const database = createDatabase(logger);
export const knex = database.instance;

const context = createContext();

vi.spyOn(context.scraper, "fetchJson").mockImplementation(async (path: string) => {
  if (path.includes("/search/rankings")) {
    return { next_index: 0 };
  }
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
  if (path.includes("rankings") && path.includes("units=kg")) {
    return rankingsDefaultKg;
  }
  if (path.includes("rankings")) {
    return rankingsDefault;
  }
  throw new Error(`No fixture for JSON path: ${path}`);
});

vi.spyOn(context.scraper, "fetchHtml").mockImplementation(async (path: string, _units?: string) => {
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
    return _units === "kg" ? userJohnHaackKgHtml : userJohnHaackHtml;
  }
  if (path.includes("kristyhawkins")) {
    return userKristyHawkinsHtml;
  }
  if (path.includes("m/uspa/1969")) {
    if (path.includes("by-wilks")) {
      return meetUspa1969ByWilksHtml;
    }
    if (path.includes("by-total")) {
      return meetUspa1969ByTotalHtml;
    }
    return _units === "kg" ? meetUspa1969KgHtml : meetUspa1969Html;
  }
  if (path.includes("records")) {
    // Most specific first: Equipment + Weight Class + Sex
    if (path.includes("ipf-classes") && path.includes("men")) {
      return recordsRawIpfClassesMenHtml;
    }
    if (path.includes("wp-classes") && path.includes("women")) {
      return recordsUnlimitedWpClassesWomenHtml;
    }

    // Equipment + Weight Class
    if (path.includes("wp-classes")) {
      return recordsUnlimitedWpClassesHtml;
    }
    if (path.includes("ipf-classes")) {
      return recordsRawIpfClassesHtml;
    }
    if (path.includes("expanded-classes")) {
      return recordsRawExpandedClassesHtml;
    }
    if (path.includes("para-classes")) {
      return recordsUnlimitedWpClassesHtml;
    }

    // Equipment + Sex combinations
    if (path.includes("raw") && (path.includes("/men") || path.endsWith("men"))) {
      return recordsRawMenHtml;
    }
    if (path.includes("raw") && (path.includes("/women") || path.endsWith("women"))) {
      return recordsRawWomenHtml;
    }

    // Equipment only
    if (path.includes("single")) {
      return recordsSingleHtml;
    }
    if (path.includes("multi")) {
      return recordsMultiHtml;
    }
    if (path.includes("all-tested")) {
      return recordsAllTestedHtml;
    }
    if (path.includes("unlimited")) {
      return recordsUnlimitedHtml;
    }
    if (path.includes("wraps")) {
      return recordsWrapsHtml;
    }
    if (path.includes("raw")) {
      return recordsRawHtml;
    }
    return recordsDefaultHtml;
  }

  const { ScraperError } = await import("../error");
  throw new ScraperError(`Not found: ${path}`, 404, path);
});

vi.spyOn(context.mail, "sendVerificationEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendMagicLinkEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendEmailChangeVerificationEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendWelcomeEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendContactEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendApiLimitResetEmail").mockResolvedValue();
vi.spyOn(context.mail, "sendReachingApiLimitEmail").mockResolvedValue();
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
        api_call_count: 0,
        api_call_limit: 750,
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
