import { describe, expect, it } from "vite-plus/test";

import { createContext } from "../../../context";
import { createRecordService } from "./records.service";

const context = createContext();
const recordService = createRecordService(context.knex);

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
