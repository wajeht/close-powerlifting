import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, test } from "vitest";

import { createContext } from "../context";

const context = createContext();
const helpers = context.helpers;
const scraper = context.scraper;

describe("tableToJson", () => {
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

  test("converts table to JSON", () => {
    const expectedData = [
      { header1: "Data 1-1", header2: "Data 1-2" },
      { header1: "Data 2-1", header2: "Data 2-2" },
    ];

    expect(scraper.tableToJson(table)).toEqual(expectedData);
  });

  test("handles empty table correctly", () => {
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

  test("handles table with only headers correctly", () => {
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

  test("handles table with only one row correctly", () => {
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

  test("handles table with only one column correctly", () => {
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

describe("buildPaginationQuery", () => {
  test("returns the correct pagination string", () => {
    const pagination = scraper.buildPaginationQuery(2, 10);
    expect(pagination).toEqual("start=10&end=20&lang=en&units=lbs");
  });

  test("handles the first page correctly", () => {
    const pagination = scraper.buildPaginationQuery(1, 10);
    expect(pagination).toEqual("start=0&end=10&lang=en&units=lbs");
  });

  test("handles the last page correctly", () => {
    const pagination = scraper.buildPaginationQuery(5, 10);
    expect(pagination).toEqual("start=40&end=50&lang=en&units=lbs");
  });

  test("handles the first page with a different number of items per page correctly", () => {
    const pagination = scraper.buildPaginationQuery(1, 5);
    expect(pagination).toEqual("start=0&end=5&lang=en&units=lbs");
  });
});

describe("stripHtml", () => {
  test("removes HTML tags from the input string", () => {
    const input = "<p>This is <strong>bold</strong> text.</p>";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("This is bold text.");
  });

  test("handles empty string correctly", () => {
    const input = "";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("");
  });

  test("handles input with no HTML tags correctly", () => {
    const input = "This is plain text.";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("This is plain text.");
  });

  test("handles input with only HTML tags correctly", () => {
    const input = "<p></p>";
    const result = scraper.stripHtml(input);
    expect(result).toEqual("");
  });
});

describe("hashKey", () => {
  test("returns a hashed key", async () => {
    const { key, hashedKey } = await helpers.hashKey();
    expect(key).toBeDefined();
    expect(hashedKey).toBeDefined();
  });

  test("returns a different key and hashed key each time", async () => {
    const { key: key1, hashedKey: hashedKey1 } = await helpers.hashKey();
    const { key: key2, hashedKey: hashedKey2 } = await helpers.hashKey();
    expect(key1).not.toEqual(key2);
    expect(hashedKey1).not.toEqual(hashedKey2);
  });
});

describe("generateAPIKey", () => {
  test("returns a hashed key", async () => {
    const { unhashedKey, hashedKey } = await helpers.generateAPIKey({
      userId: "1",
      email: "test@test.com",
      name: "Test User",
    });
    expect(unhashedKey).toBeDefined();
    expect(hashedKey).toBeDefined();
  });

  test("returns a different key and hashed key each time", async () => {
    const { unhashedKey: key1, hashedKey: hashedKey1 } = await helpers.generateAPIKey({
      userId: "1",
      email: "1test@test.com",
      name: "1Test User",
    });
    const { unhashedKey: key2, hashedKey: hashedKey2 } = await helpers.generateAPIKey({
      userId: "2",
      email: "2test@test.com",
      name: "2Test User",
    });
    expect(key1).not.toEqual(key2);
    expect(hashedKey1).not.toEqual(hashedKey2);
  });

  describe("when admin flag is passed", () => {
    test("returns a hashed key", async () => {
      const { unhashedKey, hashedKey } = await helpers.generateAPIKey({
        userId: "1",
        email: "",
        name: "",
        admin: true,
      });
      expect(unhashedKey).toBeDefined();
      expect(hashedKey).toBeDefined();
    });
  });
});

describe("calculatePagination", () => {
  test("calculates pagination for first page", () => {
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

  test("calculates pagination for middle page", () => {
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

  test("calculates pagination for last page", () => {
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

  test("handles partial last page correctly", () => {
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

  test("handles single page correctly", () => {
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

  test("handles large dataset with default per_page", () => {
    const result = scraper.calculatePagination(3000000, 1, 100);

    expect(result.items).toBe(3000000);
    expect(result.pages).toBe(30000);
    expect(result.per_page).toBe(100);
    expect(result.from).toBe(1);
    expect(result.to).toBe(100);
  });
});

describe("timingSafeEqual", () => {
  test("returns true for equal strings", () => {
    expect(helpers.timingSafeEqual("test", "test")).toBe(true);
  });

  test("returns false for different strings of same length", () => {
    expect(helpers.timingSafeEqual("test", "tset")).toBe(false);
  });

  test("returns false for strings of different length", () => {
    expect(helpers.timingSafeEqual("test", "testing")).toBe(false);
  });

  test("returns true for empty strings", () => {
    expect(helpers.timingSafeEqual("", "")).toBe(true);
  });

  test("returns false for empty vs non-empty", () => {
    expect(helpers.timingSafeEqual("", "test")).toBe(false);
  });

  test("handles special characters", () => {
    const token1 = "abc123!@#$%^&*()";
    const token2 = "abc123!@#$%^&*()";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });

  test("handles UUID-like tokens", () => {
    const token1 = "550e8400-e29b-41d4-a716-446655440000";
    const token2 = "550e8400-e29b-41d4-a716-446655440000";
    expect(helpers.timingSafeEqual(token1, token2)).toBe(true);
  });
});
