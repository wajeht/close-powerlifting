import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../config";
import { db } from "../tests/test-setup";
import { createUserRepository } from "../db/user";
import { createHelper } from "./helpers";
import { createLogger } from "./logger";
import { createAdminUser } from "./admin-user";
import { createAuthService } from "../routes/auth/auth.service";

const mockMail = {
  sendAdminCredentialsEmail: vi.fn().mockResolvedValue({}),
  sendNewApiKeyEmail: vi.fn().mockResolvedValue({}),
  sendWelcomeEmail: vi.fn().mockResolvedValue({}),
  sendVerificationEmail: vi.fn().mockResolvedValue({}),
  sendContactEmail: vi.fn().mockResolvedValue({}),
  sendApiLimitResetEmail: vi.fn().mockResolvedValue({}),
  sendReachingApiLimitEmail: vi.fn().mockResolvedValue({}),
};

describe("AdminUser", () => {
  beforeEach(async () => {
    await db("users").del();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db("users").del();
  });

  describe("initializeAdminUser", () => {
    it("should create a new admin user if one does not exist", async () => {
      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(db);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await adminUser.initializeAdminUser();

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

      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(db);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await adminUser.initializeAdminUser();

      const users = await db("users").where({ email: config.app.adminEmail });
      expect(users).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      const originalEmail = config.app.adminEmail;
      (config.app as any).adminEmail = null;

      const logger = createLogger();
      logger.setLevel("SILENT");
      const helpers = createHelper();
      const userRepository = createUserRepository(db);
      const authService = createAuthService(userRepository, helpers, mockMail);
      const adminUser = createAdminUser(userRepository, helpers, authService, mockMail, logger);

      await expect(adminUser.initializeAdminUser()).resolves.not.toThrow();

      (config.app as any).adminEmail = originalEmail;
    });
  });
});
