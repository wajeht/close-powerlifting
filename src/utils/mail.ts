import nodemailer from "nodemailer";

import emailConfig from "../config/mail.config";

const mail = nodemailer.createTransport(emailConfig);

export default mail;
