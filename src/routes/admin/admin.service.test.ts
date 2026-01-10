import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { createContext } from "../../context";
import { knex } from "../../tests/test-setup";
import { createAdminService } from "./admin.service";

const context = createContext();
const adminService = createAdminService(
  context.userRepository,
  context.cache,
  context.authService,
  context.logger,
);

describe("AdminService", () => {
  describe("getAllUsers", () => {
    let testUserIds: number[] = [];

    beforeEach(async () => {
      const users = await knex("users")
        .insert([
          {
            name: "First User",
            email: "first-admin@example.com",
            verified: true,
            created_at: "2024-01-01T00:00:00.000Z",
          },
          {
            name: "Second User",
            email: "second-admin@example.com",
            verified: true,
            created_at: "2024-06-01T00:00:00.000Z",
          },
          {
            name: "Third User",
            email: "third-admin@example.com",
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

    it("returns users sorted by created_at desc by default", async () => {
      const result = await adminService.getAllUsers();

      const testUsers = result.users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers[0].name).toBe("Second User");
      expect(testUsers[1].name).toBe("Third User");
      expect(testUsers[2].name).toBe("First User");
    });

    it("returns users sorted by created_at asc when order=asc", async () => {
      const result = await adminService.getAllUsers({ order: "asc" });

      const testUsers = result.users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers[0].name).toBe("First User");
      expect(testUsers[1].name).toBe("Third User");
      expect(testUsers[2].name).toBe("Second User");
    });

    it("searches by name case-insensitively", async () => {
      const result = await adminService.getAllUsers({ search: "FIRST" });

      const testUsers = result.users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers.length).toBe(1);
      expect(testUsers[0].name).toBe("First User");
    });

    it("searches by email case-insensitively", async () => {
      const result = await adminService.getAllUsers({ search: "second-admin" });

      const testUsers = result.users.filter((u) => testUserIds.includes(u.id));
      expect(testUsers.length).toBe(1);
      expect(testUsers[0].email).toBe("second-admin@example.com");
    });

    it("returns correct pagination with limit", async () => {
      const result = await adminService.getAllUsers({ limit: 2 });

      expect(result.users.length).toBeLessThanOrEqual(2);
      expect(result.pagination.per_page).toBe(2);
    });

    it("returns correct pagination count when searching", async () => {
      const result = await adminService.getAllUsers({ search: "admin@example" });

      expect(result.pagination.items).toBe(3);
    });
  });

  describe("getCacheEntries", () => {
    beforeEach(async () => {
      await knex("cache").insert([
        {
          key: "admin-test-old",
          value: "value1",
          created_at: "2024-01-01T00:00:00.000Z",
          updated_at: "2024-01-01T00:00:00.000Z",
        },
        {
          key: "admin-test-newest",
          value: "value2",
          created_at: "2024-06-01T00:00:00.000Z",
          updated_at: "2024-06-01T00:00:00.000Z",
        },
        {
          key: "admin-test-middle",
          value: "value3",
          created_at: "2024-03-01T00:00:00.000Z",
          updated_at: "2024-03-01T00:00:00.000Z",
        },
      ]);
    });

    afterEach(async () => {
      await knex("cache").where("key", "like", "admin-test-%").delete();
    });

    it("returns entries sorted by updated_at desc by default", async () => {
      const result = await adminService.getCacheEntries({ search: "admin-test" });

      expect(result.entries[0].key).toBe("admin-test-newest");
      expect(result.entries[1].key).toBe("admin-test-middle");
      expect(result.entries[2].key).toBe("admin-test-old");
    });

    it("returns entries sorted by updated_at asc when order=asc", async () => {
      const result = await adminService.getCacheEntries({ search: "admin-test", order: "asc" });

      expect(result.entries[0].key).toBe("admin-test-old");
      expect(result.entries[1].key).toBe("admin-test-middle");
      expect(result.entries[2].key).toBe("admin-test-newest");
    });

    it("filters by search pattern", async () => {
      const result = await adminService.getCacheEntries({ search: "admin-test-old" });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].key).toBe("admin-test-old");
    });

    it("returns correct pagination with limit", async () => {
      const result = await adminService.getCacheEntries({ search: "admin-test", limit: 2 });

      expect(result.entries.length).toBe(2);
      expect(result.pagination.per_page).toBe(2);
      expect(result.pagination.items).toBe(3);
    });

    it("handles pagination offset correctly", async () => {
      const result = await adminService.getCacheEntries({
        search: "admin-test",
        limit: 2,
        page: 2,
      });

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].key).toBe("admin-test-old");
    });
  });
});
