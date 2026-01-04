import nodemailer from "nodemailer";

import { configuration } from "./configuration";
import type { LoggerType } from "./utils/logger";

export interface MailType {
  sendVerificationEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    verification_token: string;
  }) => Promise<void>;
  sendMagicLinkEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    token: string;
  }) => Promise<void>;
  sendWelcomeEmail: (params: { email: string; name: string; key: string }) => Promise<void>;
  sendContactEmail: (params: { name: string; email: string; message: string }) => Promise<void>;
  sendApiLimitResetEmail: (params: { email: string; name: string }) => Promise<void>;
  sendReachingApiLimitEmail: (params: {
    email: string;
    name: string;
    percent: number;
  }) => Promise<void>;
}

export function createMail(logger: LoggerType): MailType {
  const transporter = nodemailer.createTransport({
    host: configuration.email.host,
    port: configuration.email.port,
    secure: configuration.email.secure,
    auth:
      configuration.email.user && configuration.email.password
        ? { user: configuration.email.user, pass: configuration.email.password }
        : undefined,
  });

  const from = `"Close Powerlifting" <${configuration.email.from}>`;

  async function send(to: string, subject: string, text: string): Promise<void> {
    try {
      await transporter.sendMail({ from, to, subject, text });
      logger.info(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      logger.error(`Failed to send email to ${to}`, error);
    }
  }

  async function sendVerificationEmail({
    hostname,
    email,
    name,
    verification_token,
  }: {
    hostname: string;
    email: string;
    name: string;
    verification_token: string;
  }): Promise<void> {
    await send(
      email,
      "Account verification",
      `Hi ${name},

Thanks for signing up for Close Powerlifting! Please verify your email address to get started:

${hostname}/verify-email?token=${verification_token}&email=${email}

Once verified, you'll receive your API key to access powerlifting data from around the world.

If you didn't create this account, you can safely ignore this email.

Cheers,
The Close Powerlifting Team`,
    );
  }

  async function sendMagicLinkEmail({
    hostname,
    email,
    name,
    token,
  }: {
    hostname: string;
    email: string;
    name: string;
    token: string;
  }): Promise<void> {
    await send(
      email,
      "Login to Close Powerlifting",
      `Hi ${name},

Click the link below to log in to your Close Powerlifting account:

${hostname}/magic-link?token=${token}&email=${email}

This link expires in 1 hour.

If you didn't request this, you can safely ignore this email.

Cheers,
The Close Powerlifting Team`,
    );
  }

  async function sendWelcomeEmail({
    email,
    name,
    key,
  }: {
    email: string;
    name: string;
    key: string;
  }): Promise<void> {
    await send(
      email,
      "API Key for Close Powerlifting",
      `Hi ${name},

You're all set! Your email has been verified and your API key is ready:

API Key: ${key}

Your key expires in 3 months. We'll send you a reminder before it does.

Check out our documentation to get started: https://close-powerlifting.jaw.dev/docs/api

Happy lifting!
The Close Powerlifting Team`,
    );
  }

  async function sendContactEmail({
    name,
    email,
    message,
  }: {
    name: string;
    email: string;
    message: string;
  }): Promise<void> {
    await send(
      configuration.email.user,
      `Contact Request from ${email}`,
      `New message from ${name} <${email}>

${message}`,
    );
  }

  async function sendApiLimitResetEmail({
    email,
    name,
  }: {
    email: string;
    name: string;
  }): Promise<void> {
    await send(
      email,
      "API Call Limit Reset",
      `Hi ${name},

Good news! Your API limit has been reset and you're back to full capacity.

Thanks for using Close Powerlifting. Happy lifting!

Cheers,
The Close Powerlifting Team`,
    );
  }

  async function sendReachingApiLimitEmail({
    email,
    name,
    percent,
  }: {
    email: string;
    name: string;
    percent: number;
  }): Promise<void> {
    await send(
      email,
      "Reaching API Limit",
      `Hi ${name},

Heads up! You've used ${percent}% of your monthly API calls.

A few tips to reduce usage:
- Cache responses when possible
- Use pagination to fetch smaller datasets
- Batch your requests during off-peak hours

Your limit resets at the start of each month. Need a higher limit? Reply to this email and let us know.

Cheers,
The Close Powerlifting Team`,
    );
  }

  return {
    sendVerificationEmail,
    sendMagicLinkEmail,
    sendWelcomeEmail,
    sendContactEmail,
    sendApiLimitResetEmail,
    sendReachingApiLimitEmail,
  };
}
