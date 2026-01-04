import { describe, expect } from "vitest";

import {
  createAuthenticatedApiAgent,
  createUnauthenticatedApiAgent,
} from "../../../tests/test-setup";

describe("GET /api/users", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/users");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should redirect to rankings without search query", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users");

    expect([302, 308]).toContain(response.status);
    expect(response.header.location).toBe("/api/rankings");
  });

  it("should return search results with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users?search=haack");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toContain("/api/users?search=haack");
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("pagination");
  });

  it("should return array of matched users", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users?search=haack");

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it("should return search results with ranking row fields", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users?search=haack");
    const entry = response.body.data[0];

    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("full_name");
    expect(entry).toHaveProperty("user_profile");
    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("total");
    expect(entry).toHaveProperty("dots");
  });
});

describe("GET /api/users/:username", () => {
  it("should return 401 without authentication", async () => {
    const response = await createUnauthenticatedApiAgent().get("/api/users/johnhaack");

    expect(response.status).toBe(401);
    expect(response.body.status).toBe("fail");
  });

  it("should return user profile with correct structure", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("The resource was returned successfully!");
    expect(response.body.request_url).toBe("/api/users/johnhaack");
    expect(response.body).toHaveProperty("data");
  });

  it("should return user data as array with profile information", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const data = response.body.data;

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);

    const user = data[0];
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("username");
    expect(user).toHaveProperty("sex");
    expect(typeof user.name).toBe("string");
    expect(typeof user.username).toBe("string");
  });

  it("should return user with instagram information", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const user = response.body.data[0];

    expect(user).toHaveProperty("instagram");
    expect(user).toHaveProperty("instagram_url");
  });

  it("should return user with personal bests array", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const user = response.body.data[0];

    expect(user).toHaveProperty("personal_best");
    expect(Array.isArray(user.personal_best)).toBe(true);
  });

  it("should return user with competition results array", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const user = response.body.data[0];

    expect(user).toHaveProperty("competition_results");
    expect(Array.isArray(user.competition_results)).toBe(true);
  });

  it("should return competition results with meet information", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const results = response.body.data[0].competition_results;

    if (results.length > 0) {
      const result = results[0];
      expect(result).toHaveProperty("place");
      expect(result).toHaveProperty("fed");
      expect(result).toHaveProperty("date");
      expect(result).toHaveProperty("location");
      expect(result).toHaveProperty("competition");
      expect(result).toHaveProperty("division");
      expect(result).toHaveProperty("equip");
      expect(result).toHaveProperty("total");
    }
  });

  it("should return 404 for non-existent username", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/nonexistent-user-xyz-12345",
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("fail");
  });
});
