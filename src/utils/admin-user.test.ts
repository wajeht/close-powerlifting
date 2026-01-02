import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../config";
import { db } from "../tests/test-setup";

vi.mock("../mail", () => ({
  Mail: () => ({
    sendAdminCredentialsEmail: vi.fn().mockResolvedValue({}),
  }),
}));

import { AdminUser } from "./admin-user";

describe("AdminUser", () => {
  beforeEach(async () => {
    await db("users").del();
  });

  afterEach(async () => {
    await db("users").del();
  });

  describe("initAdminUser", () => {
    it("should create a new admin user if one does not exist", async () => {
      const adminUser = AdminUser();

      await adminUser.initAdminUser();

      const user = await db("users").where({ email: config.app.adminEmail }).first();

      expect(user).toBeDefined();
      expect(user.email).toBe(config.app.adminEmail);
      expect(user.name).toBe(config.app.adminName);
      expect(user.admin).toBe(1); // SQLite stores booleans as 1/0
      expect(user.verified).toBe(1);
      expect(user.password).toBeDefined();
      expect(user.key).toBeDefined();
    });

    it("should not create a new admin user if one already exists", async () => {
      await db("users").insert({
        email: config.app.adminEmail,
        name: config.app.adminName,
        admin: true,
        verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const adminUser = AdminUser();
      await adminUser.initAdminUser();

      const users = await db("users").where({ email: config.app.adminEmail });
      expect(users).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      const originalEmail = config.app.adminEmail;
      (config.app as any).adminEmail = null;

      const adminUser = AdminUser();

      await expect(adminUser.initAdminUser()).resolves.not.toThrow();

      (config.app as any).adminEmail = originalEmail;
    });
  });
});
