import { describe, expect, it } from "vite-plus/test";

import {
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.schema";

describe("listMeetsQueryValidation", () => {
  it("accepts an empty query", () => {
    const result = listMeetsQueryValidation.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects malformed ISO dates", () => {
    const result = listMeetsQueryValidation.safeParse({ from: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown sort value", () => {
    const result = listMeetsQueryValidation.safeParse({ sort: "by-banana" });
    expect(result.success).toBe(false);
  });
});

describe("getMeetParamValidation", () => {
  it("requires federation + date + slug", () => {
    const result = getMeetParamValidation.safeParse({
      federation: "wrpf",
      date: "2024-05-12",
      slug: "demo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed date", () => {
    const result = getMeetParamValidation.safeParse({
      federation: "wrpf",
      date: "2024",
      slug: "demo",
    });
    expect(result.success).toBe(false);
  });
});

describe("getMeetQueryValidation", () => {
  it("accepts default units", () => {
    const result = getMeetQueryValidation.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an unknown units value", () => {
    const result = getMeetQueryValidation.safeParse({ units: "stones" });
    expect(result.success).toBe(false);
  });
});

describe("getMeetHighlightsQueryValidation", () => {
  it("accepts an empty query", () => {
    expect(getMeetHighlightsQueryValidation.safeParse({}).success).toBe(true);
  });

  it("accepts units=kg", () => {
    expect(getMeetHighlightsQueryValidation.safeParse({ units: "kg" }).success).toBe(true);
  });
});
