import nodemailer from "nodemailer";

import { config } from "../config";

const mail = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

export default mail;
