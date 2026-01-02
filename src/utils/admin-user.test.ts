import { afterEach, describe, expect, it, vi } from "vitest";

import { config } from "../config";

// Create mock functions at module level
const mockFindByEmail = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGenerateAPIKey = vi.fn();
const mockGeneratePassword = vi.fn();
const mockHashKey = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock("../db/user", () => ({
  User: () => ({
    findByEmail: mockFindByEmail,
    create: mockCreate,
    update: mockUpdate,
  }),
}));

vi.mock("bcryptjs", async () => ({
  ...((await vi.importActual("bcryptjs")) as object),
  hash: vi.fn().mockResolvedValue("hashedPassword"),
}));

vi.mock("./helpers", () => ({
  Helpers: () => ({
    generateAPIKey: mockGenerateAPIKey,
    generatePassword: mockGeneratePassword,
    hashKey: mockHashKey,
  }),
}));

vi.mock("./logger", () => ({
  Logger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../routes/auth/auth.service", () => ({
  AuthService: () => ({
    updateUser: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("../mail", () => ({
  MailService: () => ({
    sendAdminCredentialsEmail: vi.fn().mockResolvedValue({}),
  }),
}));

import { AdminUser } from "./admin-user";

const adminUser = AdminUser();

describe("init", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new admin user if one does not exist", async () => {
    mockFindByEmail.mockResolvedValueOnce(null);
    mockGeneratePassword.mockReturnValueOnce("password");
    mockHashKey.mockResolvedValueOnce({ key: "token" });
    mockCreate.mockResolvedValueOnce({
      name: config.app.adminName,
      id: 1,
      email: config.app.adminEmail,
    });
    mockGenerateAPIKey.mockResolvedValueOnce({
      hashedKey: "hashedKey",
      unhashedKey: "unhashedKey",
    });

    await adminUser.initAdminUser();

    expect(mockFindByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(mockGeneratePassword).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      email: config.app.adminEmail,
      name: config.app.adminName,
      admin: true,
      password: expect.any(String),
      verification_token: expect.any(String),
      verified: true,
      verified_at: expect.any(String),
    });

    expect(mockGenerateAPIKey).toHaveBeenCalledWith({
      admin: true,
      name: config.app.adminName,
      userId: "1",
      email: config.app.adminEmail,
    });
  });

  it("should not create a new admin user if one exists", async () => {
    mockFindByEmail.mockResolvedValueOnce({ id: 1 });

    await adminUser.initAdminUser();

    expect(mockFindByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should log an error if anything goes wrong", async () => {
    mockFindByEmail.mockRejectedValueOnce(new Error("Error message"));

    await adminUser.initAdminUser();

    expect(mockLoggerError).toHaveBeenCalledWith(new Error("Error message"));
  });
});
