import { describe, expect, it } from "vite-plus/test";

import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.schema";

describe("getRankingsValidation", () => {
  it("accepts an empty query", () => {
    expect(getRankingsValidation.safeParse({}).success).toBe(true);
  });

  it("coerces per_page", () => {
    const result = getRankingsValidation.safeParse({ per_page: "50" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.per_page).toBe(50);
  });

  it("rejects an unknown units value", () => {
    expect(getRankingsValidation.safeParse({ units: "stones" }).success).toBe(false);
  });

  it("accepts combined ranking filters and preserves the parsed types", () => {
    const result = getRankingsValidation.parse({
      equipment: "raw",
      sex: "women",
      weight_class: "84+",
      year: "2024",
      event: "full-power",
      sort: "by-total",
      age_class: "24-34",
      tested: "true",
      country: " USA ",
      federation: "ipf",
      current_page: "2",
      per_page: "25",
      units: "kg",
    });
    expect(result).toEqual({
      equipment: "raw",
      sex: "women",
      weight_class: "84+",
      year: "2024",
      event: "full-power",
      sort: "by-total",
      age_class: "24-34",
      tested: true,
      country: "USA",
      federation: "ipf",
      current_page: 2,
      per_page: 25,
      units: "kg",
    });
  });

  it.each([
    { equipment: "raw" },
    { sex: "women" },
    { weight_class: "84+" },
    { year: "2024" },
    { event: "bench" },
    { sort: "by-total" },
    { age_class: "40-44" },
    { tested: "false" },
    { country: "USA" },
  ])("accepts independent ranking filter %j", (query) => {
    expect(getRankingsValidation.safeParse(query).success).toBe(true);
  });

  it.each([
    { equipment: "invalid" },
    { sex: "other" },
    { event: "bench-pull" },
    { sort: "by-mcculloch" },
    { weight_class: "84garbage" },
    { weight_class: "84++" },
    { year: "202" },
    { year: "2024x" },
  ])("rejects invalid ranking query filter %j", (query) => {
    expect(getRankingsValidation.safeParse(query).success).toBe(false);
  });
});

describe.each([
  { name: "root rankings", schema: getRankingsValidation },
  { name: "legacy filtered rankings", schema: getFilteredRankingsQueryValidation },
])("$name shared query filters", ({ schema }) => {
  it.each([
    { input: "true", expected: true },
    { input: "false", expected: false },
  ])("parses tested=$input without treating false as true", ({ input, expected }) => {
    expect(schema.parse({ tested: input }).tested).toBe(expected);
  });

  it("keeps tested undefined when no tested filter is supplied", () => {
    expect(schema.parse({}).tested).toBeUndefined();
  });

  it.each(["yes", "1", "0", "TRUE", "", true, false])(
    "rejects invalid tested value %j",
    (tested) => {
      expect(schema.safeParse({ tested }).success).toBe(false);
    },
  );

  it("trims the athlete country filter", () => {
    expect(schema.parse({ country: " USA " }).country).toBe("USA");
  });

  it.each(["", "   ", "x".repeat(101)])("rejects invalid country %j", (country) => {
    expect(schema.safeParse({ country }).success).toBe(false);
  });
});

describe("getFilteredRankingsParamValidation", () => {
  it.each(["84", "84+", "82.5+", "-93"])("accepts weight class %s", (weightClass) => {
    expect(
      getFilteredRankingsParamValidation.safeParse({ weight_class: weightClass }).success,
    ).toBe(true);
  });

  it.each(["84garbage", "84++", "-84+"])("rejects invalid weight class %s", (weightClass) => {
    expect(
      getFilteredRankingsParamValidation.safeParse({ weight_class: weightClass }).success,
    ).toBe(false);
  });

  it("accepts every valid combination", () => {
    const result = getFilteredRankingsParamValidation.safeParse({
      equipment: "raw",
      sex: "men",
      weight_class: "100",
      year: "2024",
      event: "full-power",
      sort: "by-total",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown equipment", () => {
    expect(getFilteredRankingsParamValidation.safeParse({ equipment: "invalid" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown sex", () => {
    expect(getFilteredRankingsParamValidation.safeParse({ sex: "other" }).success).toBe(false);
  });

  it("rejects an unknown event", () => {
    expect(getFilteredRankingsParamValidation.safeParse({ event: "bench-pull" }).success).toBe(
      false,
    );
  });

  it("rejects the unsupported McCulloch sort", () => {
    expect(getFilteredRankingsParamValidation.safeParse({ sort: "by-mcculloch" }).success).toBe(
      false,
    );
  });
});

describe("getFilteredRankingsQueryValidation", () => {
  it("leaves path dimensions out of legacy query filters", () => {
    const result = getFilteredRankingsQueryValidation.parse({
      equipment: "raw",
      sex: "women",
      weight_class: "84+",
      year: "2024",
      event: "full-power",
      sort: "by-total",
      tested: "false",
      country: "USA",
    });
    expect(result.tested).toBe(false);
    expect(result.country).toBe("USA");
    for (const field of ["equipment", "sex", "weight_class", "year", "event", "sort"]) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("accepts a valid age_class", () => {
    const result = getFilteredRankingsQueryValidation.safeParse({ age_class: "24-34" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown age_class", () => {
    expect(getFilteredRankingsQueryValidation.safeParse({ age_class: "200-300" }).success).toBe(
      false,
    );
  });
});

describe("getRankValidation", () => {
  it("accepts a positive integer", () => {
    expect(getRankValidation.safeParse({ rank: "1" }).success).toBe(true);
  });

  it("rejects a non-numeric rank", () => {
    expect(getRankValidation.safeParse({ rank: "abc" }).success).toBe(false);
  });
});
