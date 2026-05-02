import { describe, expect, it } from "vite-plus/test";

import { configuration } from "../../../configuration";
import {
  getRankingsValidation,
  getFilteredRankingsQueryValidation,
  getFilteredRankingsParamValidation,
  sortEnum,
  ageClassEnum,
} from "./rankings.validation";

const { maxPerPage } = configuration.pagination;

describe.concurrent("rankings validation", () => {
  describe("getRankingsValidation", () => {
    it("accepts valid per_page within limit", () => {
      const result = getRankingsValidation.safeParse({ per_page: "100" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(100);
      }
    });

    it("caps per_page at maxPerPage", () => {
      const result = getRankingsValidation.safeParse({ per_page: "1000" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    it("accepts valid current_page", () => {
      const result = getRankingsValidation.safeParse({ current_page: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(5);
      }
    });

    it("enforces minimum current_page of 1", () => {
      const result = getRankingsValidation.safeParse({ current_page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("enforces minimum current_page of 1 for negative values", () => {
      const result = getRankingsValidation.safeParse({ current_page: "-5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_page).toBe(1);
      }
    });

    it("rejects non-numeric per_page", () => {
      const result = getRankingsValidation.safeParse({ per_page: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric current_page", () => {
      const result = getRankingsValidation.safeParse({ current_page: "abc" });
      expect(result.success).toBe(false);
    });

    it("enforces minimum per_page of 1", () => {
      const result = getRankingsValidation.safeParse({ per_page: "0" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(1);
      }
    });

    it("accepts empty object with optional fields", () => {
      const result = getRankingsValidation.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts units=lbs", () => {
      const result = getRankingsValidation.safeParse({ units: "lbs" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("accepts units=kg", () => {
      const result = getRankingsValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
      }
    });

    it("rejects invalid units value", () => {
      const result = getRankingsValidation.safeParse({ units: "stones" });
      expect(result.success).toBe(false);
    });

    it("accepts federation as free-form string", () => {
      const result = getRankingsValidation.safeParse({ federation: "uspa" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.federation).toBe("uspa");
      }
    });

    it("rejects malformed federation slugs", () => {
      const result = getRankingsValidation.safeParse({ federation: "uspa?start=0" });
      expect(result.success).toBe(false);
    });
  });

  describe("getFilteredRankingsQueryValidation", () => {
    it("caps per_page at maxPerPage", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ per_page: "999" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(maxPerPage);
      }
    });

    it("accepts units=kg", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ units: "kg" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
      }
    });

    it("rejects invalid units value", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ units: "invalid" });
      expect(result.success).toBe(false);
    });

    it("accepts federation as free-form string", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ federation: "ipf" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.federation).toBe("ipf");
      }
    });

    it("accepts valid age_class values", () => {
      const validAgeClasses = [
        "24-34",
        "40-44",
        "45-49",
        "50-54",
        "55-59",
        "60-64",
        "65-69",
        "70-74",
        "75-79",
      ];
      for (const ageClass of validAgeClasses) {
        const result = getFilteredRankingsQueryValidation.safeParse({ age_class: ageClass });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.age_class).toBe(ageClass);
        }
      }
    });

    it("rejects invalid age_class value", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({ age_class: "30-35" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric pagination values", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({
        per_page: "many",
        current_page: "later",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty object with all optional fields", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("sortEnum", () => {
    it("accepts by-goodlift", () => {
      const result = sortEnum.safeParse("by-goodlift");
      expect(result.success).toBe(true);
    });

    it("accepts by-mcculloch", () => {
      const result = sortEnum.safeParse("by-mcculloch");
      expect(result.success).toBe(true);
    });

    it("accepts all original sort values", () => {
      const originals = [
        "by-dots",
        "by-wilks",
        "by-glossbrenner",
        "by-total",
        "by-squat",
        "by-bench",
        "by-deadlift",
      ];
      for (const value of originals) {
        expect(sortEnum.safeParse(value).success).toBe(true);
      }
    });

    it("rejects invalid sort value", () => {
      const result = sortEnum.safeParse("by-invalid");
      expect(result.success).toBe(false);
    });
  });

  describe("ageClassEnum", () => {
    it("accepts all valid age classes", () => {
      const validValues = [
        "24-34",
        "40-44",
        "45-49",
        "50-54",
        "55-59",
        "60-64",
        "65-69",
        "70-74",
        "75-79",
      ];
      for (const value of validValues) {
        expect(ageClassEnum.safeParse(value).success).toBe(true);
      }
    });

    it("rejects invalid age class", () => {
      expect(ageClassEnum.safeParse("18-23").success).toBe(false);
      expect(ageClassEnum.safeParse("invalid").success).toBe(false);
    });
  });

  describe("getFilteredRankingsParamValidation with new sort values", () => {
    it("accepts by-goodlift as sort param", () => {
      const result = getFilteredRankingsParamValidation.safeParse({ sort: "by-goodlift" });
      expect(result.success).toBe(true);
    });

    it("accepts by-mcculloch as sort param", () => {
      const result = getFilteredRankingsParamValidation.safeParse({ sort: "by-mcculloch" });
      expect(result.success).toBe(true);
    });

    it("rejects malformed year params", () => {
      const result = getFilteredRankingsParamValidation.safeParse({ year: "twenty-twenty-four" });
      expect(result.success).toBe(false);
    });
  });

  describe("getRankingsValidation defaults", () => {
    it("defaults units to lbs when not provided", () => {
      const result = getRankingsValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });

    it("does not have age_class field", () => {
      const result = getRankingsValidation.safeParse({ age_class: "40-44" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).age_class).toBeUndefined();
      }
    });
  });

  describe("getFilteredRankingsQueryValidation defaults", () => {
    it("defaults units to lbs when not provided", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("lbs");
      }
    });
  });

  describe("getFilteredRankingsQueryValidation combining multiple params", () => {
    it("accepts units + federation + age_class together", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({
        units: "kg",
        federation: "uspa",
        age_class: "50-54",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units).toBe("kg");
        expect(result.data.federation).toBe("uspa");
        expect(result.data.age_class).toBe("50-54");
      }
    });

    it("accepts all query params together", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({
        per_page: "50",
        current_page: "2",
        units: "kg",
        federation: "ipf",
        age_class: "60-64",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.per_page).toBe(50);
        expect(result.data.current_page).toBe(2);
        expect(result.data.units).toBe("kg");
        expect(result.data.federation).toBe("ipf");
        expect(result.data.age_class).toBe("60-64");
      }
    });

    it("rejects when one param is invalid among valid ones", () => {
      const result = getFilteredRankingsQueryValidation.safeParse({
        units: "invalid",
        federation: "uspa",
        age_class: "40-44",
      });
      expect(result.success).toBe(false);
    });
  });
});
