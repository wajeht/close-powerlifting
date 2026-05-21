import { describe, expect, it } from "vite-plus/test";

import {
  getFederationMeetsQueryValidation,
  getFederationsParamValidation,
  getFederationsValidation,
} from "./federations.schema";

describe("getFederationsValidation", () => {
  it("accepts an empty query", () => {
    const result = getFederationsValidation.safeParse({});
    expect(result.success).toBe(true);
  });

  it("coerces per_page from a numeric string", () => {
    const result = getFederationsValidation.safeParse({ per_page: "25" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.per_page).toBe(25);
  });

  it("rejects a non-numeric per_page", () => {
    const result = getFederationsValidation.safeParse({ per_page: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("getFederationsParamValidation", () => {
  it("accepts a federation slug", () => {
    const result = getFederationsParamValidation.safeParse({ federation: "wrpf" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty slug", () => {
    const result = getFederationsParamValidation.safeParse({ federation: "" });
    expect(result.success).toBe(false);
  });
});

describe("getFederationMeetsQueryValidation", () => {
  it("parses year as a number when present", () => {
    const result = getFederationMeetsQueryValidation.safeParse({ year: "2024" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(2024);
  });

  it("rejects a non-four-digit year", () => {
    const result = getFederationMeetsQueryValidation.safeParse({ year: "20" });
    expect(result.success).toBe(false);
  });
});
