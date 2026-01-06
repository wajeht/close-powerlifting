import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configuration } from "../configuration";
import { knex, logger } from "../tests/test-setup";
import { createUserRepository } from "../db/user";
import { createAdminUser } from "./admin-user";
import { createAuthService } from "../routes/auth/auth.service";
import { createHelper } from "./helpers";

const mockMail = {
  verifyConnection: vi.fn().mockResolvedValue(true),
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
      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, mockMail, logger);
      const helpers = createHelper();
      const adminUser = createAdminUser(userRepository, authService, helpers, mockMail, logger);

      await adminUser.initializeAdminUser();

      const user = await knex("users").where({ email: configuration.app.adminEmail }).first();

      expect(user).toBeDefined();
      expect(user.email).toBe(configuration.app.adminEmail);
      expect(user.name).toBe(helpers.extractNameFromEmail(configuration.app.adminEmail));
      expect(user.admin).toBe(1); // SQLite stores booleans as 1/0
      expect(user.verified).toBe(1);
      expect(user.api_key).toBeDefined();
    });

    it("should not create a new admin user if one already exists", async () => {
      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, mockMail, logger);
      const helpers = createHelper();

      await knex("users").insert({
        email: configuration.app.adminEmail,
        name: helpers.extractNameFromEmail(configuration.app.adminEmail),
        admin: true,
        verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const adminUser = createAdminUser(userRepository, authService, helpers, mockMail, logger);

      await adminUser.initializeAdminUser();

      const users = await knex("users").where({ email: configuration.app.adminEmail });
      expect(users).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      const originalEmail = configuration.app.adminEmail;
      (configuration.app as any).adminEmail = null;

      const userRepository = createUserRepository(knex);
      const authService = createAuthService(userRepository, mockMail, logger);
      const helpers = createHelper();
      const adminUser = createAdminUser(userRepository, authService, helpers, mockMail, logger);

      await expect(adminUser.initializeAdminUser()).resolves.not.toThrow();

      (configuration.app as any).adminEmail = originalEmail;
    });
  });
});
