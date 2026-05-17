import { describe, expect, it } from "vite-plus/test";

import { getStatusValidation } from "./status.validation";

describe("getStatusValidation", () => {
  it("accepts an empty query", () => {
    const result = getStatusValidation.safeParse({});
    expect(result.success).toBe(true);
  });

  it("ignores extra fields", () => {
    const result = getStatusValidation.safeParse({ foo: "bar" });
    expect(result.success).toBe(true);
  });
});
