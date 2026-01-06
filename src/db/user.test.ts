import { describe, expect, beforeEach, afterEach, it } from "vitest";

import { knex } from "../tests/test-setup";
import { createUserRepository } from "./user";

describe("UserRepository", () => {
  const userRepository = createUserRepository(knex);

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
