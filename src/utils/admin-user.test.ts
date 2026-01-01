import { afterEach, describe, expect, it, Mock, vi } from "vitest";

import { config } from "../config";
import * as UserRepository from "../db/repositories/user.repository";
import { generateAPIKey, generatePassword, hashKey } from "../utils/helpers";
import mail from "../utils/mail";
import { init } from "./admin-user";
import logger from "./logger";

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

describe("init", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new admin user if one does not exist", async () => {
    (UserRepository.findByEmail as Mock).mockResolvedValueOnce(null);

    (generatePassword as Mock).mockReturnValueOnce("password");

    ((await hashKey) as Mock).mockResolvedValueOnce({ key: "token" });

    (UserRepository.create as Mock).mockResolvedValueOnce({
      name: config.app.adminName,
      id: 1,
      email: config.app.adminEmail,
    });

    ((await generateAPIKey) as Mock).mockResolvedValueOnce({
      hashedKey: "hashedKey",
      unhashedKey: "unhashedKey",
    });

    mail.sendMail = vi.fn().mockResolvedValue({});

    await init();

    expect(UserRepository.findByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(generatePassword).toHaveBeenCalled();
    expect(UserRepository.create).toHaveBeenCalledWith({
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
    (UserRepository.findByEmail as Mock).mockResolvedValueOnce({ id: 1 });

    await init();

    expect(UserRepository.findByEmail).toHaveBeenCalledWith(config.app.adminEmail);
    expect(UserRepository.create).not.toHaveBeenCalled();
  });

  it("should log an error if anything goes wrong", async () => {
    (UserRepository.findByEmail as Mock).mockRejectedValueOnce(new Error("Error message"));
    const errorSpy = vi.spyOn(logger, "error");

    await init();

    expect(errorSpy).toHaveBeenCalledWith(new Error("Error message"));
  });
});
