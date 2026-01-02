import nodemailer from "nodemailer";

import { config } from "./config";
import { Logger } from "./utils/logger";

export interface MailServiceType {
  sendVerificationEmail: (params: {
    hostname: string;
    email: string;
    name: string;
    verification_token: string;
  }) => Promise<void>;
  sendWelcomeEmail: (params: { email: string; name: string; key: string }) => Promise<void>;
  sendNewApiKeyEmail: (params: { email: string; name: string; key: string }) => Promise<void>;
  sendAdminCredentialsEmail: (params: {
    email: string;
    name: string;
    password: string;
    apiKey: string;
  }) => Promise<void>;
  sendContactEmail: (params: { name: string; email: string; message: string }) => Promise<void>;
  sendApiLimitResetEmail: (params: { email: string; name: string }) => Promise<void>;
  sendReachingApiLimitEmail: (params: {
    email: string;
    name: string;
    percent: number;
  }) => Promise<void>;
}

export function MailService(): MailServiceType {
  const logger = Logger();

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth:
      config.email.user && config.email.password
        ? { user: config.email.user, pass: config.email.password }
        : undefined,
  });

  const from = `"Close Powerlifting" <${config.email.from}>`;

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

Check out our documentation to get started: https://close-powerlifting.com/docs

Happy lifting!
The Close Powerlifting Team`,
    );
  }

  async function sendNewApiKeyEmail({
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
      "New API key for Close Powerlifting",
      `Hi ${name},

Your API key has been reset. Here's your new key:

API Key: ${key}

Your previous key is now inactive. This new key expires in 3 months.

If you didn't request this change, please contact us immediately.

Cheers,
The Close Powerlifting Team`,
    );
  }

  async function sendAdminCredentialsEmail({
    email,
    name,
    password,
    apiKey,
  }: {
    email: string;
    name: string;
    password: string;
    apiKey: string;
  }): Promise<void> {
    await send(
      email,
      "API Key and Admin Password for Close Powerlifting",
      `Hi ${name},

Your admin credentials have been updated:

Password: ${password}
API Key: ${apiKey}

Please change your password after logging in and store your API key securely.

Cheers,
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
      config.email.user,
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
    sendWelcomeEmail,
    sendNewApiKeyEmail,
    sendAdminCredentialsEmail,
    sendContactEmail,
    sendApiLimitResetEmail,
    sendReachingApiLimitEmail,
  };
}
