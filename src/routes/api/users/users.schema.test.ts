import { describe, expect, it } from "vite-plus/test";

import {
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.schema";

describe("getUsersValidation", () => {
  it("accepts an empty query", () => {
    expect(getUsersValidation.safeParse({}).success).toBe(true);
  });

  it("coerces per_page", () => {
    const result = getUsersValidation.safeParse({ per_page: "10" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.per_page).toBe(10);
  });
});

describe("getUserParamValidation", () => {
  it("accepts a slug", () => {
    expect(getUserParamValidation.safeParse({ username: "edcoan" }).success).toBe(true);
  });

  it("rejects an empty username", () => {
    expect(getUserParamValidation.safeParse({ username: "" }).success).toBe(false);
  });

  it("rejects a username with whitespace", () => {
    expect(getUserParamValidation.safeParse({ username: "ed coan" }).success).toBe(false);
  });
});

describe("getUserQueryValidation", () => {
  it("accepts include_attempts=true", () => {
    const result = getUserQueryValidation.safeParse({ include_attempts: "true" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown include_attempts value", () => {
    expect(getUserQueryValidation.safeParse({ include_attempts: "maybe" }).success).toBe(false);
  });
});

describe("userUnitsQueryValidation", () => {
  it("defaults to lbs", () => {
    expect(userUnitsQueryValidation.safeParse({}).success).toBe(true);
  });
});

describe("getCompareValidation", () => {
  it("requires both a and b", () => {
    expect(getCompareValidation.safeParse({ a: "edcoan", b: "johnsmith1" }).success).toBe(true);
  });

  it("rejects when one side is missing", () => {
    expect(getCompareValidation.safeParse({ a: "edcoan" }).success).toBe(false);
  });
});
