import { describe, expect, Mock, test, vi } from "vitest";

import * as UserRepository from "../../db/repositories/user.repository";
import { hashKey } from "../../utils/helpers";
import { getGoogle, postRegister } from "./auth.controllers";

vi.mock("../../utils/helpers", () => ({
  getGoogleOAuthURL: vi.fn().mockReturnValue("mock-url"),
  hashKey: vi.fn(),
  getHostName: vi.fn(),
}));

vi.mock("../../db/repositories/user.repository", async () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../api.errors", async () => ({
  UnauthorizedError: vi.fn(),
  ValidationError: vi.fn(),
}));

vi.mock("../../views/views.services", async () => ({
  sendVerificationEmail: vi.fn(),
}));

describe("getGoogle", () => {
  const req = {} as any;
  const res = {
    redirect: vi.fn(),
  } as any;

  test("redirects to google o auth url", async () => {
    await getGoogle(req, res);
    expect(res.redirect).toHaveBeenCalledWith("mock-url");
  });
});

describe("postRegister", async () => {
  test("should be able to register a user", async () => {
    const req = {
      body: {
        email: "jaw@jaw.com",
        name: "jaw",
      },
      originalUrl: "/api/auth/register",
    } as any;

    const res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    } as any;

    (UserRepository.findByEmail as Mock).mockResolvedValueOnce(null);
    (hashKey as Mock).mockResolvedValueOnce({ key: "mock-key" });
    (UserRepository.create as Mock).mockResolvedValueOnce({ id: 1, email: "jaw@jaw.com", name: "jaw" });

    await postRegister(req, res);

    expect(UserRepository.findByEmail).toHaveBeenCalledWith("jaw@jaw.com");
    expect(hashKey).toHaveBeenCalled();
    expect(UserRepository.create).toHaveBeenCalledWith({
      email: "jaw@jaw.com",
      name: "jaw",
      verification_token: "mock-key",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
