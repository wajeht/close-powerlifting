import { describe, it, expect, beforeEach } from "vitest";

import { knex } from "../tests/test-setup";
import { createApiCallLogRepository } from "./api-call-log";

describe("ApiCallLogRepository", () => {
  const repository = createApiCallLogRepository(knex);
  let testUserId: number;

  beforeEach(async () => {
    await knex("api_call_logs").del();
    await knex("users").where({ email: "api-log-test@example.com" }).del();

    const [user] = await knex("users")
      .insert({
        name: "API Log Test User",
        email: "api-log-test@example.com",
        verified: true,
      })
      .returning("*");
    testUserId = user.id;
  });

  describe("create", () => {
    it("should create an API call log entry", async () => {
      const log = await repository.create({
        user_id: testUserId,
        method: "GET",
        endpoint: "/api/rankings",
        status_code: 200,
        response_time_ms: 45,
        ip_address: "127.0.0.1",
        user_agent: "test-agent",
      });

      expect(log.id).toBeDefined();
      expect(log.user_id).toBe(testUserId);
      expect(log.method).toBe("GET");
      expect(log.endpoint).toBe("/api/rankings");
      expect(log.status_code).toBe(200);
      expect(log.response_time_ms).toBe(45);
      expect(log.ip_address).toBe("127.0.0.1");
      expect(log.user_agent).toBe("test-agent");
    });

    it("should allow null ip_address and user_agent", async () => {
      const log = await repository.create({
        user_id: testUserId,
        method: "POST",
        endpoint: "/api/users",
        status_code: 201,
        response_time_ms: 100,
        ip_address: null,
        user_agent: null,
      });

      expect(log.ip_address).toBeNull();
      expect(log.user_agent).toBeNull();
    });
  });

  describe("findByUserId", () => {
    beforeEach(async () => {
      for (let i = 0; i < 15; i++) {
        await repository.create({
          user_id: testUserId,
          method: "GET",
          endpoint: `/api/endpoint-${i}`,
          status_code: 200,
          response_time_ms: i * 10,
          ip_address: null,
          user_agent: null,
        });
      }
    });

    it("should return logs for a user with default pagination", async () => {
      const logs = await repository.findByUserId(testUserId);

      expect(logs.length).toBe(15);
    });

    it("should return logs with custom limit", async () => {
      const logs = await repository.findByUserId(testUserId, { limit: 5 });

      expect(logs.length).toBe(5);
    });

    it("should return logs with offset", async () => {
      const logs = await repository.findByUserId(testUserId, { limit: 5, offset: 10 });

      expect(logs.length).toBe(5);
    });

    it("should return logs ordered by created_at desc", async () => {
      const logs = await repository.findByUserId(testUserId, { limit: 3 });

      expect(logs[0].endpoint).toBe("/api/endpoint-14");
      expect(logs[1].endpoint).toBe("/api/endpoint-13");
      expect(logs[2].endpoint).toBe("/api/endpoint-12");
    });

    it("should return empty array for user with no logs", async () => {
      const logs = await repository.findByUserId(99999);

      expect(logs).toEqual([]);
    });
  });

  describe("countByUserId", () => {
    it("should return count of logs for a user", async () => {
      for (let i = 0; i < 5; i++) {
        await repository.create({
          user_id: testUserId,
          method: "GET",
          endpoint: "/api/test",
          status_code: 200,
          response_time_ms: 10,
          ip_address: null,
          user_agent: null,
        });
      }

      const count = await repository.countByUserId(testUserId);

      expect(count).toBe(5);
    });

    it("should return 0 for user with no logs", async () => {
      const count = await repository.countByUserId(99999);

      expect(count).toBe(0);
    });
  });

  describe("deleteOlderThan", () => {
    it("should delete logs older than cutoff date", async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      await knex("api_call_logs").insert({
        user_id: testUserId,
        method: "GET",
        endpoint: "/api/old",
        status_code: 200,
        response_time_ms: 10,
        created_at: oldDate.toISOString(),
      });

      await repository.create({
        user_id: testUserId,
        method: "GET",
        endpoint: "/api/new",
        status_code: 200,
        response_time_ms: 10,
        ip_address: null,
        user_agent: null,
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const deletedCount = await repository.deleteOlderThan(cutoff);

      expect(deletedCount).toBe(1);

      const remaining = await knex("api_call_logs").where({ user_id: testUserId });
      expect(remaining.length).toBe(1);
      expect(remaining[0].endpoint).toBe("/api/new");
    });

    it("should return 0 when no logs to delete", async () => {
      await repository.create({
        user_id: testUserId,
        method: "GET",
        endpoint: "/api/recent",
        status_code: 200,
        response_time_ms: 10,
        ip_address: null,
        user_agent: null,
      });

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);

      const deletedCount = await repository.deleteOlderThan(cutoff);

      expect(deletedCount).toBe(0);
    });
  });

  describe("findAll", () => {
    it("should return all logs with pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await repository.create({
          user_id: testUserId,
          method: "GET",
          endpoint: `/api/test-${i}`,
          status_code: 200,
          response_time_ms: 10,
          ip_address: null,
          user_agent: null,
        });
      }

      const logs = await repository.findAll({ limit: 3 });

      expect(logs.length).toBe(3);
    });
  });

  describe("count", () => {
    it("should return total count of all logs", async () => {
      for (let i = 0; i < 7; i++) {
        await repository.create({
          user_id: testUserId,
          method: "GET",
          endpoint: "/api/test",
          status_code: 200,
          response_time_ms: 10,
          ip_address: null,
          user_agent: null,
        });
      }

      const count = await repository.count();

      expect(count).toBe(7);
    });
  });
});
