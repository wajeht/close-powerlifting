import { describe, expect, it } from "vite-plus/test";

import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.validation";

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
});

describe("getFilteredRankingsParamValidation", () => {
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
});

describe("getFilteredRankingsQueryValidation", () => {
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
