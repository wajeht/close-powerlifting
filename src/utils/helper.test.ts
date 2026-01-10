import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it } from "vitest";

import { createContext } from "../context";

const context = createContext();
const scraper = context.scraper;
const authService = context.authService;
const helpers = context.helpers;

describe.concurrent("tableToJson", () => {
  let table: any;

  beforeEach(() => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Data 1-1</td>
          <td>Data 1-2</td>
        </tr>
        <tr>
          <td>Data 2-1</td>
          <td>Data 2-2</td>
        </tr>
      </table>
    `);

    table = dom.window.document.querySelector("table");
  });

  it("converts table to JSON", () => {
    const expectedData = [
      { header1: "Data 1-1", header2: "Data 1-2" },
      { header1: "Data 2-1", header2: "Data 2-2" },
    ];

    expect(scraper.tableToJson(table)).toEqual(expectedData);
  });

  it("handles empty table correctly", () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector("table");
    expect(scraper.tableToJson(table)).toEqual([]);
  });

  it("handles table with only headers correctly", () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector("table");
    expect(scraper.tableToJson(table)).toEqual([]);
  });

  it("handles table with only one row correctly", () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Data 1-1</td>
          <td>Data 1-2</td>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector("table");
    expect(scraper.tableToJson(table)).toEqual([{ header1: "Data 1-1", header2: "Data 1-2" }]);
  });

  it("handles table with only one column correctly", () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
        </tr>
        <tr>
          <td>Data 1-1</td>
        </tr>
        <tr>
          <td>Data 2-1</td>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector("table");
    expect(scraper.tableToJson(table)).toEqual([{ header1: "Data 1-1" }, { header1: "Data 2-1" }]);
  });
});

describe.concurrent("buildPaginationQuery", () => {
  it("returns the correct pagination string", () => {
    const pagination = scraper.buildPaginationQuery(2, 10);
    expect(pagination).toEqual("start=10&end=20&lang=en&units=lbs");
  });

  it("handles the first page correctly", () => {
    const pagination = scraper.buildPaginationQuery(1, 10);
    expect(pagination).toEqual("start=0&end=10&lang=en&units=lbs");
  });

  it("handles the last page correctly", () => {
    const pagination = scraper.buildPaginationQuery(5, 10);
    expect(pagination).toEqual("start=40&end=50&lang=en&units=lbs");
  });

  it("handles the first page with a different number of items per page correctly", () => {
    const pagination = scraper.buildPaginationQuery(1, 5);
    expect(pagination).toEqual("start=0&end=5&lang=en&units=lbs");
  });
});

describe.concurrent("stripHtml", () => {
  it("removes HTML tags from the input string", () => {
    const input = "<p>This is <strong>bold</strong> text.</p>";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("This is bold text.");
  });

  it("handles empty string correctly", () => {
    const input = "";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("");
  });

  it("handles input with no HTML tags correctly", () => {
    const input = "This is plain text.";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("This is plain text.");
  });

  it("handles input with only HTML tags correctly", () => {
    const input = "<p></p>";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("");
  });
});

describe.concurrent("helpers.generateToken", () => {
  it("returns a token", () => {
    const token = helpers.generateToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
  });

  it("returns a different token each time", () => {
    const token1 = helpers.generateToken();
    const token2 = helpers.generateToken();
    expect(token1).not.toEqual(token2);
  });

  it("returns a valid UUID format", () => {
    const token = helpers.generateToken();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidRegex);
  });
});

describe.concurrent("authService.generateKey", () => {
  it("returns an API key", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 1,
    });
    expect(apiKey).toBeDefined();
    expect(typeof apiKey).toBe("string");
  });

  it("returns a different key each time for different users", () => {
    const key1 = authService.generateKey({
      userId: "1",
      email: "1test@test.com",
      name: "1Test User",
      apiKeyVersion: 1,
    });
    const key2 = authService.generateKey({
      userId: "2",
      email: "2test@test.com",
      name: "2Test User",
      apiKeyVersion: 1,
    });
    expect(key1).not.toEqual(key2);
  });

  it("expires in 90 days for regular users", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 1,
    });

    const payload = JSON.parse(atob(apiKey.split(".")[1]!));
    const expiresInSeconds = payload.exp - payload.iat;
    const ninetyDaysInSeconds = 90 * 24 * 60 * 60;

    expect(expiresInSeconds).toBe(ninetyDaysInSeconds);
  });

  it("includes apiKeyVersion in the payload", () => {
    const apiKey = authService.generateKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
      apiKeyVersion: 5,
    });

    const payload = JSON.parse(atob(apiKey.split(".")[1]!));
    expect(payload.apiKeyVersion).toBe(5);
  });

  describe("when admin flag is passed", () => {
    it("returns an API key", () => {
      const apiKey = authService.generateKey({
        userId: "1",
        email: "",
        name: "",
        apiKeyVersion: 1,
        admin: true,
      });
      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe("string");
    });

    it("expires in 1 year for admin users", () => {
      const apiKey = authService.generateKey({
        userId: "1",
        email: "admin@test.com",
        name: "Admin User",
        apiKeyVersion: 1,
        admin: true,
      });

      const payload = JSON.parse(atob(apiKey.split(".")[1]!));
      const expiresInSeconds = payload.exp - payload.iat;
      // JWT library uses 365.25 days for "1y" to account for leap years
      const oneYearInSeconds = 365.25 * 24 * 60 * 60;

      expect(expiresInSeconds).toBe(oneYearInSeconds);
    });
  });
});

describe.concurrent("calculatePagination", () => {
  it("calculates pagination for first page", () => {
    const result = scraper.calculatePagination(100, 1, 10);

    expect(result).toEqual({
      items: 100,
      pages: 10,
      per_page: 10,
      current_page: 1,
      last_page: 10,
      first_page: 1,
      from: 1,
      to: 10,
    });
  });

  it("calculates pagination for middle page", () => {
    const result = scraper.calculatePagination(100, 5, 10);

    expect(result).toEqual({
      items: 100,
      pages: 10,
      per_page: 10,
      current_page: 5,
      last_page: 10,
      first_page: 1,
      from: 41,
      to: 50,
    });
  });

  it("calculates pagination for last page", () => {
    const result = scraper.calculatePagination(100, 10, 10);

    expect(result).toEqual({
      items: 100,
      pages: 10,
      per_page: 10,
      current_page: 10,
      last_page: 10,
      first_page: 1,
      from: 91,
      to: 100,
    });
  });

  it("handles partial last page correctly", () => {
    const result = scraper.calculatePagination(95, 10, 10);

    expect(result).toEqual({
      items: 95,
      pages: 10,
      per_page: 10,
      current_page: 10,
      last_page: 10,
      first_page: 1,
      from: 91,
      to: 95,
    });
  });

  it("handles single page correctly", () => {
    const result = scraper.calculatePagination(5, 1, 10);

    expect(result).toEqual({
      items: 5,
      pages: 1,
      per_page: 10,
      current_page: 1,
      last_page: 1,
      first_page: 1,
      from: 1,
      to: 5,
    });
  });

  it("handles large dataset with default per_page", () => {
    const result = scraper.calculatePagination(3000000, 1, 100);

    expect(result.items).toBe(3000000);
    expect(result.pages).toBe(30000);
    expect(result.per_page).toBe(100);
    expect(result.from).toBe(1);
    expect(result.to).toBe(100);
  });
});

describe.concurrent("helpers.timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(helpers.timingSafeEqual("test", "test")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(helpers.timingSafeEqual("test", "tset")).toBe(false);
  });

  it("returns false for strings of different length", () => {
    expect(helpers.timingSafeEqual("test", "testing")).toBe(false);
  });

  it("returns true for empty strings", () => {
    expect(helpers.timingSafeEqual("", "")).toBe(true);
  });

  it("returns false for empty vs non-empty", () => {
    expect(helpers.timingSafeEqual("", "test")).toBe(false);
  });

  it("handles special characters", () => {
    const token1 = "abc123!@#$%^&*()";
    const token2 = "abc123!@#$%^&*()";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });

  it("handles UUID-like tokens", () => {
    const token1 = "550e8400-e29b-41d4-a716-446655440000";
    const token2 = "550e8400-e29b-41d4-a716-446655440000";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });
});

describe.concurrent("helpers.paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  it("returns first page with default limit", () => {
    const result = helpers.paginate(items);
    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.pagination.current_page).toBe(1);
    expect(result.pagination.pages).toBe(2);
    expect(result.pagination.per_page).toBe(10);
  });

  it("returns second page", () => {
    const result = helpers.paginate(items, { page: 2 });
    expect(result.items).toEqual([11, 12]);
    expect(result.pagination.current_page).toBe(2);
  });

  it("clamps page to max when exceeding total pages", () => {
    const result = helpers.paginate(items, { page: 999 });
    expect(result.pagination.current_page).toBe(2);
    expect(result.items).toEqual([11, 12]);
  });

  it("clamps page to 1 when below 1", () => {
    const result = helpers.paginate(items, { page: 0 });
    expect(result.pagination.current_page).toBe(1);
  });

  it("respects custom limit", () => {
    const result = helpers.paginate(items, { limit: 5 });
    expect(result.items).toEqual([1, 2, 3, 4, 5]);
    expect(result.pagination.pages).toBe(3);
    expect(result.pagination.per_page).toBe(5);
  });

  it("handles empty array", () => {
    const result = helpers.paginate([]);
    expect(result.items).toEqual([]);
    expect(result.pagination.pages).toBe(1);
    expect(result.pagination.current_page).toBe(1);
    expect(result.pagination.from).toBe(0);
    expect(result.pagination.to).toBe(0);
  });

  it("calculates from/to correctly", () => {
    const result = helpers.paginate(items, { page: 1, limit: 5 });
    expect(result.pagination.from).toBe(1);
    expect(result.pagination.to).toBe(5);
  });

  it("calculates from/to correctly for partial last page", () => {
    const result = helpers.paginate(items, { page: 3, limit: 5 });
    expect(result.pagination.from).toBe(11);
    expect(result.pagination.to).toBe(12);
  });
});

describe.concurrent("helpers.extractNameFromEmail", () => {
  it("extracts name from simple email", () => {
    expect(helpers.extractNameFromEmail("john@example.com")).toBe("John");
  });

  it("extracts name with dots", () => {
    expect(helpers.extractNameFromEmail("john.doe@example.com")).toBe("John Doe");
  });

  it("extracts name with underscores", () => {
    expect(helpers.extractNameFromEmail("john_doe@example.com")).toBe("John Doe");
  });

  it("extracts name with hyphens", () => {
    expect(helpers.extractNameFromEmail("john-doe@example.com")).toBe("John Doe");
  });

  it("extracts name with mixed separators", () => {
    expect(helpers.extractNameFromEmail("john.doe_smith-jr@example.com")).toBe("John Doe Smith Jr");
  });

  it("capitalizes each word", () => {
    expect(helpers.extractNameFromEmail("JOHN.DOE@example.com")).toBe("John Doe");
  });

  it("handles single character parts", () => {
    expect(helpers.extractNameFromEmail("j.doe@example.com")).toBe("J Doe");
  });
});
