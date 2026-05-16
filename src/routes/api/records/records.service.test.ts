import { describe, expect, it, vi } from "vite-plus/test";

import { createContext } from "../../../context";
import { createRecordService } from "./records.service";

const context = createContext();
const scraper = context.scraper;
const recordService = createRecordService(context.knex, scraper);

describe("records service", () => {
  describe("parseSexOrWeightClass", () => {
    it("parses equipment and sex (men)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "men");
      expect(result).toEqual({ equipment: "raw", sex: "men" });
    });

    it("parses equipment and sex (women)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "women");
      expect(result).toEqual({ equipment: "unlimited", sex: "women" });
    });

    it("parses equipment and weight class (wp-classes)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "wp-classes");
      expect(result).toEqual({ equipment: "unlimited", weight_class: "wp-classes" });
    });

    it("parses equipment and weight class (ipf-classes)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "ipf-classes");
      expect(result).toEqual({ equipment: "raw", weight_class: "ipf-classes" });
    });

    it("parses equipment and weight class (expanded-classes)", () => {
      const result = recordService.parseSexOrWeightClass("raw", "expanded-classes");
      expect(result).toEqual({ equipment: "raw", weight_class: "expanded-classes" });
    });

    it("parses equipment and weight class (para-classes)", () => {
      const result = recordService.parseSexOrWeightClass("unlimited", "para-classes");
      expect(result).toEqual({ equipment: "unlimited", weight_class: "para-classes" });
    });

    it("throws ValidationError for invalid equipment", () => {
      expect(() => recordService.parseSexOrWeightClass("invalid", "men")).toThrow(
        "Invalid equipment parameter!",
      );
    });

    it("throws NotFoundError for invalid sex or weight class", () => {
      expect(() => recordService.parseSexOrWeightClass("raw", "invalid")).toThrow(
        "Invalid sex or weight class parameter!",
      );
    });
  });

  describe("parseRecordsCacheKey", () => {
    it("returns null for non-records keys", () => {
      expect(recordService.parseRecordsCacheKey("status")).toBeNull();
      expect(recordService.parseRecordsCacheKey("user-johnhaack-lbs")).toBeNull();
    });

    it("parses base records key", () => {
      expect(recordService.parseRecordsCacheKey("records")).toEqual({ filterPath: "" });
    });

    it("parses records key with filter path", () => {
      expect(recordService.parseRecordsCacheKey("records/raw")).toEqual({ filterPath: "/raw" });
      expect(recordService.parseRecordsCacheKey("records/raw/men")).toEqual({
        filterPath: "/raw/men",
      });
    });
  });

  describe("getRecords (DB-backed)", () => {
    it("returns the 7 standard categories", async () => {
      const result = await recordService.getRecords({});
      expect(result.data).toHaveLength(7);
      const titles = result.data!.map((c) => c.title);
      expect(titles).toContain("Squat (Full Power)");
      expect(titles).toContain("Bench (Full Power)");
      expect(titles).toContain("Deadlift (Full Power)");
      expect(titles).toContain("Total");
    });

    it("each category exposes title + records array", async () => {
      const result = await recordService.getRecords({});
      for (const category of result.data!) {
        expect(category).toHaveProperty("title");
        expect(category).toHaveProperty("records");
        expect(Array.isArray(category.records)).toBe(true);
      }
    });
  });
});

describe("records service refreshCacheKey", () => {
  it("returns false for non-records keys", async () => {
    expect(await recordService.refreshCacheKey("status")).toBe(false);
  });

  it("returns true for base records key without re-scraping (lifts now)", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache");
    const result = await recordService.refreshCacheKey("records");
    expect(result).toBe(true);
    expect(refreshSpy).not.toHaveBeenCalled();
    refreshSpy.mockRestore();
  });

  it("returns true for filtered records key without re-scraping", async () => {
    const refreshSpy = vi.spyOn(scraper, "refreshCache");
    const result = await recordService.refreshCacheKey("records/raw/men/40-44");
    expect(result).toBe(true);
    expect(refreshSpy).not.toHaveBeenCalled();
    refreshSpy.mockRestore();
  });
});
