import nodemailer from "nodemailer";

import { config } from "../config";

const mail = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth:
    config.email.user && config.email.password
      ? {
          user: config.email.user,
          pass: config.email.password,
        }
      : undefined,
});

export default mail;
