import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";

import { configuration } from "../../configuration";
import { createContext } from "../../context";
import { app, knex } from "../../tests/test-setup";

const context = createContext();

describe("AuthService", () => {
  describe("generateKey", () => {
    it("should generate JWT with HS256 algorithm", () => {
      const key = context.authService.generateKey({
        userId: "123",
        name: "Test",
        email: "test@example.com",
        apiKeyVersion: 1,
      });

      const decoded = jwt.decode(key, { complete: true });
      expect(decoded?.header.alg).toBe("HS256");
    });

    it("should include apiKeyVersion in token payload", () => {
      const key = context.authService.generateKey({
        userId: "123",
        name: "Test",
        email: "test@example.com",
        apiKeyVersion: 5,
      });

      const decoded = jwt.decode(key) as jwt.JwtPayload;
      expect(decoded.apiKeyVersion).toBe(5);
    });

    it("should generate different expiry for admin vs regular users", () => {
      const regularKey = context.authService.generateKey({
        userId: "123",
        name: "Test",
        email: "test@example.com",
        apiKeyVersion: 1,
        admin: false,
      });

      const adminKey = context.authService.generateKey({
        userId: "123",
        name: "Test",
        email: "test@example.com",
        apiKeyVersion: 1,
        admin: true,
      });

      const regularDecoded = jwt.decode(regularKey) as jwt.JwtPayload;
      const adminDecoded = jwt.decode(adminKey) as jwt.JwtPayload;

      // Admin keys should expire later than regular keys
      expect(adminDecoded.exp! - adminDecoded.iat!).toBeGreaterThan(
        regularDecoded.exp! - regularDecoded.iat!,
      );
    });
  });

  describe("validateKey", () => {
    let testUserId: number;

    beforeAll(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Validate Key Test",
          email: "validate-key-test@example.com",
          api_key_version: 2,
          verified: true,
        })
        .returning("*");
      testUserId = user.id;
    });

    afterAll(async () => {
      await knex("users").where({ id: testUserId }).delete();
    });

    it("should accept key with matching version", async () => {
      const key = context.authService.generateKey({
        userId: String(testUserId),
        name: "Validate Key Test",
        email: "validate-key-test@example.com",
        apiKeyVersion: 2,
      });

      const result = await context.authService.validateKey(key);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(testUserId);
    });

    it("should reject key with mismatched version", async () => {
      const key = context.authService.generateKey({
        userId: String(testUserId),
        name: "Validate Key Test",
        email: "validate-key-test@example.com",
        apiKeyVersion: 1, // DB has version 2
      });

      const result = await context.authService.validateKey(key);
      expect(result).toBeNull();
    });

    it("should reject key for non-existent user", async () => {
      const key = context.authService.generateKey({
        userId: "999999",
        name: "Ghost User",
        email: "ghost@example.com",
        apiKeyVersion: 1,
      });

      const result = await context.authService.validateKey(key);
      expect(result).toBeNull();
    });

    it("should reject malformed JWT", async () => {
      const result = await context.authService.validateKey("not-a-valid-jwt");
      expect(result).toBeNull();
    });

    it("should reject JWT signed with wrong secret", async () => {
      const fakeKey = jwt.sign(
        {
          id: testUserId,
          name: "Hacker",
          email: "hacker@example.com",
          apiKeyVersion: 2,
        },
        "wrong-secret",
        { algorithm: "HS256" },
      );

      const result = await context.authService.validateKey(fakeKey);
      expect(result).toBeNull();
    });

    it("should reject JWT with none algorithm (algorithm confusion attack)", async () => {
      // This creates a token without signature verification
      const unsignedPayload = Buffer.from(
        JSON.stringify({
          id: testUserId,
          name: "Hacker",
          email: "hacker@example.com",
          apiKeyVersion: 2,
        }),
      ).toString("base64url");

      const unsignedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
        "base64url",
      );

      const unsignedToken = `${unsignedHeader}.${unsignedPayload}.`;

      const result = await context.authService.validateKey(unsignedToken);
      expect(result).toBeNull();
    });

    it("should reject expired JWT", async () => {
      const expiredKey = jwt.sign(
        {
          id: testUserId,
          name: "Validate Key Test",
          email: "validate-key-test@example.com",
          apiKeyVersion: 2,
        },
        configuration.app.jwtSecret,
        { algorithm: "HS256", expiresIn: "-1h" },
      );

      const result = await context.authService.validateKey(expiredKey);
      expect(result).toBeNull();
    });
  });

  describe("regenerateKey", () => {
    let testUserId: number;
    const testEmail = "regenerate-test@example.com";

    beforeAll(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Regenerate Key Test",
          email: testEmail,
          api_key_version: 1,
          verified: true,
        })
        .returning("*");
      testUserId = user.id;
    });

    afterAll(async () => {
      await knex("users").where({ id: testUserId }).delete();
    });

    it("should invalidate old key after regeneration", async () => {
      const oldKey = context.authService.generateKey({
        userId: String(testUserId),
        name: "Regenerate Key Test",
        email: testEmail,
        apiKeyVersion: 1,
      });

      const oldKeyValid = await context.authService.validateKey(oldKey);
      expect(oldKeyValid).not.toBeNull();

      await context.authService.regenerateKey(testUserId);

      const oldKeyAfterRegen = await context.authService.validateKey(oldKey);
      expect(oldKeyAfterRegen).toBeNull();
    });

    it("should increment api_key_version in database", async () => {
      const beforeUser = await knex("users").where({ id: testUserId }).first();
      const beforeVersion = beforeUser.api_key_version;

      await context.authService.regenerateKey(testUserId);

      const afterUser = await knex("users").where({ id: testUserId }).first();
      expect(afterUser.api_key_version).toBe(beforeVersion + 1);
    });

    it("should generate new key that works", async () => {
      const newKey = await context.authService.regenerateKey(testUserId);

      const result = await context.authService.validateKey(newKey);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(testUserId);
    });
  });
});

describe("Security: Deleted User API Access", () => {
  let testUserId: number;
  let testApiKey: string;
  const testEmail = "deleted-user-api@example.com";

  afterEach(async () => {
    if (testUserId) {
      await knex("users").where({ id: testUserId }).delete();
    }
  });

  it("should allow API access before user is deleted", async () => {
    const [user] = await knex("users")
      .insert({
        name: "Deleted User API Test",
        email: testEmail,
        api_key_version: 1,
        api_call_count: 0,
        api_call_limit: 100,
        verified: true,
      })
      .returning("*");
    testUserId = user.id;

    testApiKey = context.authService.generateKey({
      userId: String(user.id),
      name: "Deleted User API Test",
      email: testEmail,
      apiKeyVersion: 1,
    });

    await knex("users").where({ id: user.id }).update({ api_key: testApiKey });

    const response = await request(app)
      .get("/api/status")
      .set("Authorization", `Bearer ${testApiKey}`);

    expect(response.status).toBe(200);
  });

  it("should deny API access after user is deleted", async () => {
    const [user] = await knex("users")
      .insert({
        name: "Delete API Test",
        email: "delete-api-test@example.com",
        api_key_version: 1,
        api_call_count: 0,
        api_call_limit: 100,
        verified: true,
      })
      .returning("*");
    testUserId = user.id;

    testApiKey = context.authService.generateKey({
      userId: String(user.id),
      name: "Delete API Test",
      email: "delete-api-test@example.com",
      apiKeyVersion: 1,
    });

    await knex("users").where({ id: user.id }).update({ api_key: testApiKey });

    const beforeResponse = await request(app)
      .get("/api/status")
      .set("Authorization", `Bearer ${testApiKey}`);
    expect(beforeResponse.status).toBe(200);

    await context.userRepository.delete(user.id);

    const afterResponse = await request(app)
      .get("/api/status")
      .set("Authorization", `Bearer ${testApiKey}`);

    expect(afterResponse.status).toBe(401);
    expect(afterResponse.body.message).toContain("Invalid or revoked");

    testUserId = 0;
  });

  it("should reject API key for non-existent user", async () => {
    const fakeKey = context.authService.generateKey({
      userId: "999999",
      name: "Ghost User",
      email: "ghost@example.com",
      apiKeyVersion: 1,
    });

    const response = await request(app)
      .get("/api/status")
      .set("Authorization", `Bearer ${fakeKey}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain("Invalid or revoked");

    testUserId = 0;
  });
});
