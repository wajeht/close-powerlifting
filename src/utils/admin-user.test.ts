import { afterEach, describe, expect, it, Mock, vi } from "vitest";

import { config } from "../config";
import { findByEmail, create } from "../db/repositories/user.repository";
import { generateAPIKey, generatePassword, hashKey } from "../utils/helpers";
import { initAdminUser } from "./admin-user";
import { logger } from "./logger";

vi.mock("../db/repositories/user.repository", async () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("bcryptjs", async () => ({
  ...((await vi.importActual("bcryptjs")) as object),
  bcrypt: {
    hash: vi.fn(),
  },
}));

vi.mock("./helpers", async () => ({
  ...((await vi.importActual("./helpers")) as object),
  generateAPIKey: vi.fn(),
  generatePassword: vi.fn(),
  hashKey: vi.fn(),
}));

vi.mock("../mail", async () => ({
  mailService: {
    sendAdminCredentialsEmail: vi.fn(),
  },
}));

describe("init", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new admin user if one does not exist", async () => {
    (findByEmail as Mock).mockResolvedValueOnce(null);

    (generatePassword as Mock).mockReturnValueOnce("password");

    ((await hashKey) as Mock).mockResolvedValueOnce({ key: "token" });

    (create as Mock).mockResolvedValueOnce({
      name: config.app.adminName,
      id: 1,
      email: config.app.adminEmail,
    });

    ((await generateAPIKey) as Mock).mockResolvedValueOnce({
      hashedKey: "hashedKey",
      unhashedKey: "unhashedKey",
    });

    await initAdminUser();

    expect(findByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(generatePassword).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      email: config.app.adminEmail,
      name: config.app.adminName,
      admin: true,
      password: expect.any(String),
      verification_token: expect.any(String),
      verified: true,
      verified_at: expect.any(String),
    });

    expect(generateAPIKey).toHaveBeenCalledWith({
      admin: true,
      name: config.app.adminName,
      userId: "1",
      email: config.app.adminEmail,
    });
  });

  it("should not create a new admin user if one exists", async () => {
    (findByEmail as Mock).mockResolvedValueOnce({ id: 1 });

    await initAdminUser();

    expect(findByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(create).not.toHaveBeenCalled();
  });

  it("should log an error if anything goes wrong", async () => {
    (findByEmail as Mock).mockRejectedValueOnce(new Error("Error message"));
    const errorSpy = vi.spyOn(logger, "error");

    await initAdminUser();

    expect(errorSpy).toHaveBeenCalledWith(new Error("Error message"));
  });
});
