import nodemailer from "nodemailer";

import { config } from "../config";

const transportOptions: nodemailer.TransportOptions = {
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
} as nodemailer.TransportOptions;

// Only add auth if credentials are provided (not needed for mailpit in dev)
if (config.email.user && config.email.password && config.app.env === "production") {
  (transportOptions as any).auth = {
    user: config.email.user,
    pass: config.email.password,
  };
}

const mail = nodemailer.createTransport(transportOptions);

export default mail;
