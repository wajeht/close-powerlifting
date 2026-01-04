import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configuration } from "../configuration";
import { knex } from "../tests/test-setup";
import { createUserRepository } from "../db/user";
import { createHelper } from "./helpers";
import { createLogger } from "./logger";
import { createAdminUser } from "./admin-user";
import { createAuthService } from "../routes/auth/auth.service";

const mockMail = {
  sendMagicLinkEmail: vi.fn().mockResolvedValue({}),
  sendWelcomeEmail: vi.fn().mockResolvedValue({}),
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendContactEmail: vi.fn().mockResolvedValue({}),
  sendApiLimitResetEmail: vi.fn().mockResolvedValue({}),
  sendReachingApiLimitEmail: vi.fn().mockResolvedValue({}),
};

describe("AdminUser", () => {
  beforeEach(async () => {
    await knex("users").del();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await knex("users").del();
  });

  describe("initializeAdminUser", () => {
    it("should create a new admin user if one does not exist", async () => {
      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await adminUser.initializeAdminUser();

      const user = await knex("users").where({ email: configuration.app.adminEmail }).first();

      expect(user).toBeDefined();
      expect(user.email).toBe(configuration.app.adminEmail);
      expect(user.name).toBe(configuration.app.adminName);
      expect(user.admin).toBe(1); // SQLite stores booleans as 1/0
      expect(user.verified).toBe(1);
      expect(user.key).toBeDefined();
    });

    it("should not create a new admin user if one already exists", async () => {
      await knex("users").insert({
        email: configuration.app.adminEmail,
        name: configuration.app.adminName,
        admin: true,
        verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await adminUser.initializeAdminUser();

      const users = await knex("users").where({ email: configuration.app.adminEmail });
      expect(users).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      const originalEmail = configuration.app.adminEmail;
      (configuration.app as any).adminEmail = null;

      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await expect(adminUser.initializeAdminUser()).resolves.not.toThrow();

      (configuration.app as any).adminEmail = originalEmail;
    });
  });
});
