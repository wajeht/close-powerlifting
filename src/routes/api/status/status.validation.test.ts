import { describe, expect, it } from "vitest";

import { getStatusValidation } from "./status.validation";

describe.concurrent("status validation", () => {
  describe("getStatusValidation", () => {
    it("accepts empty object", () => {
      expect(getStatusValidation.safeParse({}).success).toBe(true);
    });

    it("strips unknown properties", () => {
      const result = getStatusValidation.safeParse({ unknown: "value" });
      expect(result.success).toBe(true);
    });
  });
});
