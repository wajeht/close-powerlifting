import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/status", () => {
  it("returns counts from the loaded snapshot", async () => {
    const res = await app.request("/api/status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.data.lifters).toBe(5);
    expect(body.data.meets).toBe(3);
    expect(body.data.entries).toBe(6);
    expect(body.data.federations).toBe(3);
  });
});
