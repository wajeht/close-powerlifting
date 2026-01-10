import { describe, expect, beforeEach, afterEach, it } from "vitest";

import { knex } from "../tests/test-setup";
import { createUserRepository } from "./user";

describe("UserRepository", () => {
  const userRepository = createUserRepository(knex);

  describe("findAll", () => {
    let testUserIds: number[] = [];

    beforeEach(async () => {
      const users = await knex("users")
        .insert([
          {
            name: "First User",
            email: "first-findall@example.com",
            verified: true,
            created_at: "2024-01-01T00:00:00.000Z",
          },
          {
            name: "Second User",
            email: "second-findall@example.com",
            verified: true,
            created_at: "2024-06-01T00:00:00.000Z",
          },
          {
            name: "Third User",
            email: "third-findall@example.com",
            verified: true,
            created_at: "2024-03-01T00:00:00.000Z",
          },
        ])
        .returning("*");
      testUserIds = users.map((u) => u.id);
    });

    afterEach(async () => {
      await knex("users").whereIn("id", testUserIds).delete();
    });

    it("should return users ordered by field asc", async () => {
      const users = await userRepository.findAll({
        where: { verified: true },
        orderBy: "created_at",
        order: "asc",
      });

      const testUsers = users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers[0].name).toBe("First User");
      expect(testUsers[1].name).toBe("Third User");
      expect(testUsers[2].name).toBe("Second User");
    });

    it("should return users ordered by field desc", async () => {
      const users = await userRepository.findAll({
        where: { verified: true },
        orderBy: "created_at",
        order: "desc",
      });

      const testUsers = users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers[0].name).toBe("Second User");
      expect(testUsers[1].name).toBe("Third User");
      expect(testUsers[2].name).toBe("First User");
    });

    it("should respect limit and offset", async () => {
      const users = await userRepository.findAll({
        orderBy: "created_at",
        order: "asc",
        limit: 2,
        offset: 0,
      });

      expect(users.length).toBeLessThanOrEqual(2);
    });

    it("should search by name case-insensitively", async () => {
      const users = await userRepository.findAll({
        search: "FIRST",
      });

      const testUsers = users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers.length).toBe(1);
      expect(testUsers[0].name).toBe("First User");
    });

    it("should search by email case-insensitively", async () => {
      const users = await userRepository.findAll({
        search: "SECOND-FINDALL",
      });

      const testUsers = users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers.length).toBe(1);
      expect(testUsers[0].email).toBe("second-findall@example.com");
    });

    it("should combine search with ordering and pagination", async () => {
      const users = await userRepository.findAll({
        search: "findall",
        orderBy: "created_at",
        order: "desc",
        limit: 2,
      });

      const testUsers = users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers.length).toBe(2);
      expect(testUsers[0].name).toBe("Second User");
      expect(testUsers[1].name).toBe("Third User");
    });
  });

  describe("count", () => {
    let testUserId: number;

    beforeEach(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Count Test User",
          email: "count-test@example.com",
          verified: true,
        })
        .returning("*");
      testUserId = user.id;
    });

    afterEach(async () => {
      await knex("users").where({ id: testUserId }).delete();
    });

    it("should return total count of users", async () => {
      const count = await userRepository.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it("should return count with where clause", async () => {
      const count = await userRepository.count({ email: "count-test@example.com" });
      expect(count).toBe(1);
    });

    it("should return 0 for non-matching where clause", async () => {
      const count = await userRepository.count({ email: "nonexistent@example.com" });
      expect(count).toBe(0);
    });

    it("should return count with search parameter", async () => {
      const count = await userRepository.count({}, "count-test");
      expect(count).toBe(1);
    });

    it("should return 0 for non-matching search", async () => {
      const count = await userRepository.count({}, "nonexistent-search-term");
      expect(count).toBe(0);
    });
  });

  describe("consumeToken", () => {
    let testUserId: number;
    const testEmail = "consume-token-test@example.com";
    const testToken = "test-verification-token";

    beforeEach(async () => {
      const [user] = await knex("users")
        .insert({
          name: "Consume Token Test",
          email: testEmail,
          verification_token: testToken,
          magic_link_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          verified: true,
        })
        .returning("*");
      testUserId = user.id;
    });

    afterEach(async () => {
      await knex("users").where({ id: testUserId }).delete();
    });

    it("should return true and clear token when token matches", async () => {
      const result = await userRepository.consumeToken(testUserId, testToken);

      expect(result).toBe(true);

      const user = await userRepository.findById(testUserId);
      expect(user?.verification_token).toBeNull();
      expect(user?.magic_link_expires_at).toBeNull();
    });

    it("should return false when token does not match", async () => {
      const result = await userRepository.consumeToken(testUserId, "wrong-token");

      expect(result).toBe(false);

      const user = await userRepository.findById(testUserId);
      expect(user?.verification_token).toBe(testToken);
    });

    it("should return false when user does not exist", async () => {
      const result = await userRepository.consumeToken(999999, testToken);

      expect(result).toBe(false);
    });

    it("should return false when token is already consumed", async () => {
      const firstResult = await userRepository.consumeToken(testUserId, testToken);
      expect(firstResult).toBe(true);

      const secondResult = await userRepository.consumeToken(testUserId, testToken);
      expect(secondResult).toBe(false);
    });

    it("should return false when token is null", async () => {
      await knex("users").where({ id: testUserId }).update({ verification_token: null });

      const result = await userRepository.consumeToken(testUserId, testToken);

      expect(result).toBe(false);
    });

    it("should update the updated_at timestamp", async () => {
      const beforeUser = await userRepository.findById(testUserId);
      const beforeUpdatedAt = beforeUser?.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await userRepository.consumeToken(testUserId, testToken);

      const afterUser = await userRepository.findById(testUserId);
      expect(afterUser?.updated_at).not.toBe(beforeUpdatedAt);
    });
  });
});
