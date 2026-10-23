import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createApp } from "./app";
import { configuration } from "./configuration";
import { createTestContext } from "./tests/fixtures";

vi.mock("./configuration", async (importOriginal) => {
  const original = await importOriginal<typeof import("./configuration")>();
  return {
    configuration: {
      ...original.configuration,
      app: {
        ...original.configuration.app,
        env: "production",
        domain: "https://closepowerlifting.com/",
      },
    },
  };
});

let app: ReturnType<typeof createApp>;
let context: ReturnType<typeof createTestContext>;

beforeEach(() => {
  context = createTestContext();
  app = createApp(context);
});

describe("public browser access in production", () => {
  it.each([
    "https://client.example",
    "http://localhost:5173",
    "https://closepowerlifting.com",
    "null",
  ])("should allow an anonymous API request from %s", async (origin) => {
    expect(configuration.app.env).toBe("production");
    const response = await app.request("/api/rankings?per_page=1&units=kg", {
      headers: { Origin: origin },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    const body = await response.json();
    expect(body.status).toBe("success");
    expect(body.data).toHaveLength(1);
  });

  it("should keep server-to-server requests working without an Origin header", async () => {
    const response = await app.request("/api/status");

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("success");
  });

  it("should allow cross-origin HEAD requests", async () => {
    const response = await app.request("/api/status", {
      method: "HEAD",
      headers: { Origin: "https://client.example" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.text()).toBe("");
  });

  it("should allow read-only preflights with requested headers", async () => {
    const response = await app.request("/api/rankings", {
      method: "OPTIONS",
      headers: {
        Origin: "https://client.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "if-none-match, x-request-id",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    expect(response.headers.get("Access-Control-Allow-Methods")?.split(",")).toEqual([
      "GET",
      "HEAD",
      "OPTIONS",
    ]);
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("if-none-match,x-request-id");
    expect(await response.text()).toBe("");
  });

  it("should expose cache, rate-limit, and request ID headers to browser clients", async () => {
    const response = await app.request("/api/status", {
      headers: { Origin: "https://client.example" },
    });

    const exposedHeaders = response.headers.get("Access-Control-Expose-Headers")?.split(",");
    for (const name of [
      "ETag",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "X-Request-Id",
    ]) {
      expect(exposedHeaders).toContain(name);
      expect(response.headers.get(name)).not.toBeNull();
    }
  });

  it("should preserve browser access and exposed headers on conditional responses", async () => {
    const initial = await app.request("/api/status", {
      headers: { Origin: "https://client.example" },
    });
    const entityTag = initial.headers.get("ETag");
    if (entityTag == null) throw new Error("Expected an ETag on the initial response");
    const response = await app.request("/api/status", {
      headers: { Origin: "https://client.example", "If-None-Match": entityTag },
    });

    expect(response.status).toBe(304);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
    expect(response.headers.get("Access-Control-Expose-Headers")).toBe(
      initial.headers.get("Access-Control-Expose-Headers"),
    );
    expect(response.headers.get("ETag")).toBe(entityTag);
    expect(response.headers.get("RateLimit-Remaining")).toBe("98");
    expect(response.headers.get("X-Request-Id")).not.toBeNull();
    expect(await response.text()).toBe("");
  });

  it.each([
    { path: "/api/rankings?tested=yes", status: 400 },
    { path: "/api/does-not-exist", status: 404 },
  ])("should let browsers read $status errors", async ({ path, status }) => {
    const response = await app.request(path, { headers: { Origin: "https://client.example" } });

    expect(response.status).toBe(status);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false);
  });

  it("should let browsers read readiness errors", async () => {
    context.store.reset();
    const response = await app.request("/api/status", {
      headers: { Origin: "https://client.example" },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("should preserve rate limiting and let browsers read its response", async () => {
    const options = {
      headers: { Origin: "https://client.example", "X-Forwarded-For": "198.51.100.11" },
    };
    for (let count = 0; count < 100; count++) {
      expect((await app.request("/api/status", options)).status).toBe(200);
    }
    const response = await app.request("/api/status", options);

    expect(response.status).toBe(429);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect((await response.json()).status).toBe("fail");
  });
});
