import { describe, expect, it } from "vitest";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

describe("GET /api/rankings", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/rankings");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
    expect(response.body.message).toContain("Authorization");
  });

  it("should return rankings data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/rankings");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  it("should return array of ranking entries", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return ranking entries with required fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("full_name");
    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("user_profile");
    expect(entry).toHaveProperty("country");
    expect(entry).toHaveProperty("fed");
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("sex");
    expect(entry).toHaveProperty("equip");
    expect(entry).toHaveProperty("body_weight");
    expect(entry).toHaveProperty("weight_class");
    expect(entry).toHaveProperty("squat");
    expect(entry).toHaveProperty("bench");
    expect(entry).toHaveProperty("deadlift");
    expect(entry).toHaveProperty("total");
    expect(entry).toHaveProperty("dots");
  });

  it("should return correct data types for ranking fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");
    const entry = response.body.data[0];

    expect(typeof entry.rank).toBe("number");
    expect(typeof entry.full_name).toBe("string");
    expect(typeof entry.dots).toBe("number");
    expect(typeof entry.total).toBe("number");
    expect(typeof entry.squat).toBe("number");
    expect(typeof entry.bench).toBe("number");
    expect(typeof entry.deadlift).toBe("number");
    expect(typeof entry.body_weight).toBe("number");
  });

  it("should return pagination with required fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");
    const pagination = response.body.pagination;

    expect(pagination).toHaveProperty("items");
    expect(pagination).toHaveProperty("pages");
    expect(pagination).toHaveProperty("per_page");
    expect(pagination).toHaveProperty("current_page");
    expect(pagination).toHaveProperty("last_page");
    expect(pagination).toHaveProperty("first_page");
    expect(pagination).toHaveProperty("from");
    expect(pagination).toHaveProperty("to");
  });

  it("should accept per_page query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?per_page=5");

    expect(response.status).toBe(200);
    expect(Number(response.body.pagination.per_page)).toBe(5);
  });

  it("should accept current_page query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?current_page=2");

    expect(response.status).toBe(200);
    expect(Number(response.body.pagination.current_page)).toBe(2);
  });

  it("should return entries sorted by DOTS score by default", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings");
    const entries = response.body.data;

    if (entries.length > 1) {
      expect(entries[0].dots).toBeGreaterThanOrEqual(entries[1].dots);
    }
  });
});

describe("GET /api/rankings/filter/:equipment", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/rankings/filter/raw");

    expect(response.status).toBe(401);
  });

  it("should filter by raw equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should filter by wraps equipment", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/wraps");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid equipment", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/invalid-equipment",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
    expect(response.body).toHaveProperty("errors");
  });
});

describe("GET /api/rankings/filter/:equipment/:sex", () => {
  it("should filter by equipment and sex (men)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw/men");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should filter by equipment and sex (women)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw/women");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid sex", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw/invalid");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings/filter/:equipment/:sex/:weight_class", () => {
  it("should filter by equipment, sex, and weight class", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw/women/75");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should return rankings data with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw/women/75");

    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });
});

describe("GET /api/rankings/:rank", () => {
  it("should return single ranking entry by rank number", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/1");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.data).toHaveProperty("rank");
    expect(response.body.data.rank).toBe(1);
  });

  it("should return ranking with all required fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/1");
    const entry = response.body.data;

    expect(entry).toHaveProperty("full_name");
    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("total");
    expect(entry).toHaveProperty("dots");
    expect(entry).toHaveProperty("squat");
    expect(entry).toHaveProperty("bench");
    expect(entry).toHaveProperty("deadlift");
  });

  it("should return 404 for non-numeric rank", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/invalid");

    expect(response.status).toBe(404);
  });

  it("should return 404 for very large rank number", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/999999999");

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings with units query parameter", () => {
  it("should accept units=lbs query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?units=lbs");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should accept units=kg query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?units=kg");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid units value", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?units=stones");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings with federation query parameter", () => {
  it("should accept federation query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?federation=uspa");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});

describe("GET /api/rankings/filter with units query parameter", () => {
  it("should accept units=kg on filtered rankings", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings/filter/raw?units=kg");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid units on filtered rankings", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw?units=invalid",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings/filter with federation query parameter", () => {
  it("should accept federation query parameter on filtered rankings", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw?federation=uspa",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });
});

describe("GET /api/rankings/filter with age_class query parameter", () => {
  it("should accept valid age_class on filtered rankings", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men?age_class=40-44",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid age_class", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men?age_class=invalid",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/rankings/filter with sort values", () => {
  const sortOptions = [
    "by-dots",
    "by-wilks",
    "by-glossbrenner",
    "by-goodlift",
    "by-mcculloch",
    "by-total",
    "by-squat",
    "by-bench",
    "by-deadlift",
  ];

  for (const sort of sortOptions) {
    it(`should accept ${sort} sort`, async () => {
      const response = await createAuthenticatedApiAgent().get(
        `/api/rankings/filter/raw/men/100/2024/full-power/${sort}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
    });
  }
});

describe("GET /api/rankings combining multiple query parameters", () => {
  it("should accept units + federation together on base rankings", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings?units=kg&federation=uspa",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it("should accept units + federation + age_class on filtered rankings", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men?units=kg&federation=uspa&age_class=40-44",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should accept age_class on deeper filter route with weight_class", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men/100?age_class=50-54",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should accept federation + units on deeper filter route", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men/100?federation=ipf&units=kg",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should accept all query params with pagination on filtered route", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/rankings/filter/raw/men?units=kg&federation=uspa&age_class=40-44&per_page=50&current_page=1",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body).toHaveProperty("pagination");
    expect(Number(response.body.pagination.per_page)).toBe(50);
  });

  it("should return data array when using units=kg on base rankings", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?units=kg");

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return different body_weight values for kg vs default (lbs)", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/rankings");
    const kgResponse = await createAuthenticatedApiAgent().get("/api/rankings?units=kg");

    const defaultEntry = defaultResponse.body.data[0];
    const kgEntry = kgResponse.body.data[0];

    expect(defaultEntry.full_name).toBe("Kristy Hawkins");
    expect(kgEntry.full_name).toBe("Kristy Hawkins");
    expect(defaultEntry.body_weight).toBe(163.1);
    expect(kgEntry.body_weight).toBe(74.0);
  });

  it("should return different lift values for kg vs default (lbs)", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/rankings");
    const kgResponse = await createAuthenticatedApiAgent().get("/api/rankings?units=kg");

    const defaultEntry = defaultResponse.body.data[0];
    const kgEntry = kgResponse.body.data[0];

    expect(defaultEntry.squat).toBe(683.4);
    expect(kgEntry.squat).toBe(310.0);
    expect(defaultEntry.total).toBe(1598.3);
    expect(kgEntry.total).toBe(725.0);
  });

  it("should return pagination when using federation on base rankings", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/rankings?federation=uspa");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("pagination");
    expect(response.body.pagination).toHaveProperty("items");
  });
});
