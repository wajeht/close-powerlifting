import { describe, expect, it } from "vite-plus/test";

import {
  meetSortEnum,
  getMeetQueryValidation,
  getMeetHighlightsParamValidation,
  getMeetHighlightsQueryValidation,
} from "./meets.validation";

describe.concurrent("meets validation", () => {
  describe("meetSortEnum", () => {
    it("accepts all 13 sort values", () => {
      const validValues = [
        "by-dots",
        "by-wilks",
        "by-wilks2020",
        "by-glossbrenner",
        "by-goodlift",
        "by-ipf-points",
        "by-mcculloch",
        "by-total",
        "by-ah",
        "by-nasa",
        "by-reshel",
        "by-schwartz-malone",
        "by-division",
      ];
      for (const value of validValues) {
        expect(meetSortEnum.safeParse(value).success).toBe(true);
      }
    });

    it("rejects invalid sort value", () => {
      expect(meetSortEnum.safeParse("by-invalid").success).toBe(false);
    });

    it("rejects empty string", () => {
      expect(meetSortEnum.safeParse("").success).toBe(false);
    });
  });

  describe("getMeetQueryValidation", () => {
    it("accepts empty object", () => {
      const result = getMeetQueryValidation.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts valid sort", () => {
      const result = getMeetQueryValidation.safeParse({ sort: "by-wilks" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe("by-wilks");
      }
    });

    it("rejects invalid sort", () => {
      const result = getMeetQueryValidation.safeParse({ sort: "by-invalid" });
      expect(result.success).toBe(false);
    });

    it("accepts units=lbs", () => {
      const result = getMeetQueryValidation.safeParse({ units: "lbs" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts units=kg", () => {
      const result = getMeetQueryValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
      }
    });

    it("rejects invalid units", () => {
      const result = getMeetQueryValidation.safeParse({ units: "stones" });
      expect(result.success).toBe(false);
    });

    it("defaults units to lbs when not provided", () => {
      const result = getMeetQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts sort + units together", () => {
      const result = getMeetQueryValidation.safeParse({ sort: "by-total", units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe("by-total");
        expect(result.data.units).toBe("kg");
      }
    });

    it("rejects invalid sort with valid units", () => {
      const result = getMeetQueryValidation.safeParse({ sort: "invalid", units: "kg" });
      expect(result.success).toBe(false);
    });

    it("rejects valid sort with invalid units", () => {
      const result = getMeetQueryValidation.safeParse({ sort: "by-dots", units: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  describe("getMeetHighlightsParamValidation", () => {
    it("accepts a string meet path", () => {
      const result = getMeetHighlightsParamValidation.safeParse({
        meet: "wrpf/2024-05-12/wrpfamericanpro",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meet).toBe("wrpf/2024-05-12/wrpfamericanpro");
      }
    });

    it("joins array meet path with slashes", () => {
      const result = getMeetHighlightsParamValidation.safeParse({
        meet: ["wrpf", "2024-05-12", "wrpfamericanpro"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meet).toBe("wrpf/2024-05-12/wrpfamericanpro");
      }
    });
  });

  describe("getMeetHighlightsQueryValidation", () => {
    it("accepts no params (units defaults to lbs)", () => {
      const result = getMeetHighlightsQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts units=kg", () => {
      const result = getMeetHighlightsQueryValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
    });

    it("rejects invalid units", () => {
      const result = getMeetHighlightsQueryValidation.safeParse({ units: "stones" });
      expect(result.success).toBe(false);
    });
  });
});
