import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../../app";
import { createTestContext } from "../../../tests/fixtures";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  const context = createTestContext();
  app = createApp(context);
});

describe("GET /api/federations", () => {
  it("lists distinct federations with pagination", async () => {
    const res = await app.request("/api/federations");
    expect(res.status).toBe(200);
    const body = await res.json();
    const slugs = body.data.map((f: { slug: string }) => f.slug);
    expect(slugs).toContain("wrpf");
    expect(slugs).toContain("usapl");
    expect(slugs).toContain("ipf");
    expect(body.pagination.items).toBe(3);
  });

  it("returns the federation + its meets", async () => {
    const res = await app.request("/api/federations/wrpf");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.code).toBe("WRPF");
    expect(body.data.meet_count).toBe(1);
    expect(body.data.meets[0].path).toBe("wrpf/2024-05-12/wrpfamericanpro");
  });

  it("reports meet counts grouped by year via /stats", async () => {
    const res = await app.request("/api/federations/wrpf/stats");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total_meets).toBe(1);
    expect(body.data.meets_by_year[0]).toEqual({ year: 2024, meet_count: 1 });
  });
});
