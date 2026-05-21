import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/rankings", () => {
  it("returns lifters sorted by dots descending with pagination", async () => {
    const res = await app.request("/api/rankings?per_page=2&units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].username).toBe("edcoan");
    expect(body.data[0].rank).toBe(1);
    expect(body.pagination.current_page).toBe(1);
    expect(body.pagination.per_page).toBe(2);
    expect(body.pagination.items).toBe(5);
  });

  it("paginates via current_page + per_page", async () => {
    const res = await app.request("/api/rankings?per_page=1&current_page=2&units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].rank).toBe(2);
  });
});

describe("GET /api/rankings/filter", () => {
  it("filters by equipment and sex", async () => {
    const res = await app.request("/api/rankings/filter/raw/men?units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    const usernames = body.data.map((r: { username: string }) => r.username);
    expect(usernames).toContain("edcoan");
    expect(usernames).not.toContain("johnsmith1");
  });

  it("supports custom sort metric in the deepest filter route", async () => {
    const res = await app.request(
      "/api/rankings/filter/raw/men/100/2024/full-power/by-total?units=kg",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].username).toBe("edcoan");
  });
});

describe("GET /api/rankings/:rank", () => {
  it("returns the lifter at that rank", async () => {
    const res = await app.request("/api/rankings/1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe("edcoan");
  });

  it("404s when rank is out of range", async () => {
    const res = await app.request("/api/rankings/999");
    expect(res.status).toBe(404);
  });
});
