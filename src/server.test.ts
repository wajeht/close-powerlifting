import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { app } from "./app";

describe("server", () => {
  let server: any;

  beforeAll(() => {
    server = app.listen(3000);
  });

  afterAll((done) => {
    server.close(done);
  });

  test("GET / should return 200 OK", async () => {
    const response = await request(server).get("/");
    expect(response.status).toBe(200);
  });

  test("GET /health-check should return", async () => {
    const response = await request(server).get("/health-check");
    expect(response.status).toBe(200);
  });
});
