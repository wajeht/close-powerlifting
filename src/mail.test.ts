import nodemailer from "nodemailer";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createMail } from "./mail";
import type { LoggerType } from "./utils/logger";

function createMockLogger(): LoggerType {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    box: vi.fn(),
    setLevel: vi.fn(),
  };
}

describe("mail", () => {
  let sendMailSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMailSpy = vi.fn(() => Promise.resolve({ messageId: "test" }));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: sendMailSpy,
      verify: vi.fn(() => Promise.resolve(true)),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
  });

  describe("sendVerificationEmail URL encoding", () => {
    it("should percent-encode + in the email query parameter", async () => {
      const mail = createMail(createMockLogger());

      await mail.sendVerificationEmail({
        hostname: "https://example.com",
        email: "user+tag@example.com",
        name: "User",
        verification_token: "tok-123",
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      const text = sendMailSpy.mock.calls[0][0].text as string;

      // Bare `+` would be decoded as space by Express query parsing,
      // breaking verification for any email containing `+`.
      expect(text).toContain("email=user%2Btag%40example.com");
      expect(text).not.toMatch(/email=user\+tag@example\.com/);
    });

    it("should percent-encode other reserved characters (& # space)", async () => {
      const mail = createMail(createMockLogger());

      await mail.sendVerificationEmail({
        hostname: "https://example.com",
        email: "weird&user#1@example.com",
        name: "User",
        verification_token: "tok-123",
      });

      const text = sendMailSpy.mock.calls[0][0].text as string;
      expect(text).toContain("email=weird%26user%231%40example.com");
    });
  });

  describe("sendMagicLinkEmail URL encoding", () => {
    it("should percent-encode + in the email query parameter", async () => {
      const mail = createMail(createMockLogger());

      await mail.sendMagicLinkEmail({
        hostname: "https://example.com",
        email: "user+tag@example.com",
        name: "User",
        token: "magic-token",
      });

      expect(sendMailSpy).toHaveBeenCalledTimes(1);
      const text = sendMailSpy.mock.calls[0][0].text as string;

      expect(text).toContain("email=user%2Btag%40example.com");
      expect(text).not.toMatch(/email=user\+tag@example\.com/);
    });
  });
});
