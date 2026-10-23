import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/rankings", () => {
  it("combines independent query filters and returns matching athlete country and tested status", async () => {
    const response = await app.request(
      "/api/rankings?equipment=raw&sex=women&weight_class=60&year=2023&event=full-power&sort=by-total&age_class=40-44&tested=true&country=usa&federation=ipf&per_page=1&units=kg",
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject([
      { rank: 1, username: "ruthrabbitt", country: "USA", tested: true, total: 530, units: "kg" },
    ]);
    expect(body.pagination.items).toBe(1);
  });

  it("selects the best entry inside country and tested filters", async () => {
    const response = await app.request("/api/rankings?country=canada&tested=true&units=kg");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject([
      { rank: 1, username: "edcoan", country: "Canada", tested: true, dots: 685, total: 1055 },
    ]);
  });

  it("keeps false tested filters distinct from an omitted filter", async () => {
    const response = await app.request("/api/rankings?tested=false&country=USA");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination.items).toBe(3);
    expect(body.data).toMatchObject([
      { username: "edcoan", dots: 700, tested: false },
      { username: "johnsmith1", tested: false },
      { username: "kristyhawkins", tested: false },
    ]);
  });

  it("sorts global rankings by another metric without requiring other filters", async () => {
    const response = await app.request("/api/rankings?sort=by-squat&per_page=3&units=kg");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject([
      { username: "edcoan", squat: 410 },
      { username: "marisrazmanis", squat: 365 },
      { username: "johnsmith1", squat: 360 },
    ]);
  });

  it("filters open-ended weight classes without an equipment or sex prefix", async () => {
    const response = await app.request("/api/rankings?weight_class=84%2B&units=kg");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination.items).toBe(1);
    expect(body.data).toMatchObject([{ weight_class_kg: 84, weight_class_over: true, total: 530 }]);
  });

  it.each([
    "equipment=invalid",
    "sex=other",
    "tested=yes",
    "tested=",
    "country=",
    "year=24",
    "weight_class=84garbage",
    "sort=by-mcculloch",
  ])("rejects invalid query filter %s", async (query) => {
    const response = await app.request(`/api/rankings?${query}`);
    expect(response.status).toBe(400);
  });

  it("publishes the new filters and tested response field in OpenAPI", async () => {
    const response = await app.request("/docs/api.json");
    const specification = await response.json();
    const names = specification.paths["/api/rankings"].get.parameters.map(
      (parameter: { name: string }) => parameter.name,
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "equipment",
        "sex",
        "weight_class",
        "year",
        "event",
        "sort",
        "age_class",
        "country",
        "tested",
        "federation",
      ]),
    );
    expect(specification.components.schemas.RankingEntry.properties.tested.type).toBe("boolean");
  });

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
    expect(body.pagination.items).toBe(6);
  });

  it("paginates via current_page + per_page", async () => {
    const res = await app.request("/api/rankings?per_page=1&current_page=2&units=kg");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].rank).toBe(2);
  });
});

describe("GET /api/rankings/filter", () => {
  it("matches query-based filtering and supports country and tested constraints", async () => {
    const pathResponse = await app.request(
      "/api/rankings/filter/raw/men/100/2024/full-power/by-total?country=canada&tested=true&units=kg",
    );
    const queryResponse = await app.request(
      "/api/rankings?equipment=raw&sex=men&weight_class=100&year=2024&event=full-power&sort=by-total&country=canada&tested=true&units=kg",
    );
    expect(pathResponse.status).toBe(200);
    expect(queryResponse.status).toBe(200);
    const pathBody = await pathResponse.json();
    const queryBody = await queryResponse.json();
    expect(pathBody.data).toEqual(queryBody.data);
    expect(pathBody.pagination).toEqual(queryBody.pagination);
    expect(pathBody.data).toMatchObject([
      { username: "edcoan", tested: true, country: "Canada", total: 1055 },
    ]);
  });

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

  it("rejects the unsupported McCulloch sort", async () => {
    const res = await app.request("/api/rankings/filter/raw/men/100/2024/full-power/by-mcculloch");
    expect(res.status).toBe(400);
  });

  it("does not advertise the unsupported McCulloch sort in OpenAPI", async () => {
    const res = await app.request("/docs/api.json");
    expect(res.status).toBe(200);
    const specification = await res.text();
    expect(specification).toContain("by-dots");
    expect(specification).not.toContain("by-mcculloch");
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
