import { describe, expect, it } from "vite-plus/test";

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

  it("should accept include_attempts=false query parameter", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=false",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    const user = response.body.data[0];
    expect(user).toHaveProperty("competition_results");
    const keys = Object.keys(user.competition_results[0]);
    const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
    expect(hasNumberedColumns).toBe(false);
  });

  it("should accept include_attempts=true and return attempt data", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=true",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    const user = response.body.data[0];
    expect(user).toHaveProperty("competition_results");
    const keys = Object.keys(user.competition_results[0]);
    const hasNumberedColumns = keys.some((k) => /^(squat|bench|deadlift)\d+$/.test(k));
    expect(hasNumberedColumns).toBe(true);
  });

  it("should return 400 for invalid include_attempts value", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=yes",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});

describe("GET /api/users/:username default include_attempts behavior", () => {
  it("should strip attempt columns by default (no include_attempts param)", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack");

    expect(response.status).toBe(200);
    const user = response.body.data[0];
    expect(user).toHaveProperty("competition_results");
    const keys = Object.keys(user.competition_results[0]);
    const hasNumberedColumns = keys.some((k: string) => /^(squat|bench|deadlift)\d+$/.test(k));
    expect(hasNumberedColumns).toBe(false);
  });

  it("should return fewer keys without attempts than with attempts", async () => {
    const withoutResponse = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=false",
    );
    const withResponse = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=true",
    );

    const keysWithout = Object.keys(withoutResponse.body.data[0].competition_results[0]);
    const keysWith = Object.keys(withResponse.body.data[0].competition_results[0]);
    expect(keysWith.length).toBeGreaterThan(keysWithout.length);
  });

  it("should accept units=kg on user profile", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack?units=kg");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return different personal best values with units=kg vs default", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const kgResponse = await createAuthenticatedApiAgent().get("/api/users/johnhaack?units=kg");

    const defaultPb = defaultResponse.body.data[0].personal_best[0];
    const kgPb = kgResponse.body.data[0].personal_best[0];

    expect(defaultPb.equip).toBe("Raw");
    expect(kgPb.equip).toBe("Raw");
    expect(defaultPb.squat).toBe("821.2");
    expect(kgPb.squat).toBe("372.5");
    expect(defaultPb.total).toBe("2300.5");
    expect(kgPb.total).toBe("1043.5");
  });

  it("should return different competition result values with units=kg vs default", async () => {
    const defaultResponse = await createAuthenticatedApiAgent().get("/api/users/johnhaack");
    const kgResponse = await createAuthenticatedApiAgent().get("/api/users/johnhaack?units=kg");

    const defaultComp = defaultResponse.body.data[0].competition_results[0];
    const kgComp = kgResponse.body.data[0].competition_results[0];

    expect(defaultComp.total).toBe("2237.7");
    expect(kgComp.total).toBe("1015");
  });

  it("should return 400 for invalid units on user profile", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users/johnhaack?units=invalid");

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });

  it("should accept units + include_attempts together on user profile", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?units=kg&include_attempts=true",
    );

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
    const user = response.body.data[0];
    expect(user).toHaveProperty("competition_results");
  });

  it("should have squat, bench, deadlift best values when attempts are excluded", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users/johnhaack?include_attempts=false",
    );

    const result = response.body.data[0].competition_results[0];
    expect(result).toHaveProperty("squat");
    expect(result).toHaveProperty("bench");
    expect(result).toHaveProperty("deadlift");
  });
});

describe("GET /api/users with units query parameter", () => {
  it("should accept units=kg on user search", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users?search=haack&units=kg");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should accept units=lbs on user search", async () => {
    const response = await createAuthenticatedApiAgent().get("/api/users?search=haack&units=lbs");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");
  });

  it("should return 400 for invalid units on user search", async () => {
    const response = await createAuthenticatedApiAgent().get(
      "/api/users?search=haack&units=invalid",
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("fail");
  });
});
