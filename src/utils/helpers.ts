import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request } from "express";
import jwt from "jsonwebtoken";

import { config } from "../config";
import { UserParams } from "../routes/auth/auth.service";

type buildPaginationType = {
  current_page: number;
  per_page: number;
};

export function buildPagination({ current_page, per_page }: buildPaginationType): string {
  const start = current_page === 1 ? 0 : current_page * per_page;
  const end = start + per_page;
  return `start=${start}&end=${end}&lang=en&units=lbs`;
}

export function tableToJson(table: any) {
  const data = [];

  // first row needs to be headers
  const headers: string[] = [];
  for (let i = 0; i < table.rows[0].cells.length; i++) {
    headers[i] = table.rows[0].cells[i].innerHTML.toLowerCase().replace(/ /gi, "");
  }

  // go through cells
  for (let i = 1; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    const rowData = {};

    for (let j = 0; j < tableRow.cells.length; j++) {
      // @ts-ignore
      rowData[headers[j]] = tableRow.cells[j].innerHTML.replace(/(<([^>]+)>)/gi, "");
    }

    data.push(rowData);
  }

  return data;
}

export function stripHTML(innerHTML: string): string {
  return innerHTML.replace(/(<([^>]+)>)/gi, "");
}

export function getHostName(req: Request): string {
  let origin = "";

  if (config.app.env === "development") {
    const protocol = req.protocol;
    const hostname = req.get("host");
    origin = `${protocol}://${hostname}`;
  } else {
    origin = config.app.domain;
  }

  return origin;
}

export async function hashKey() {
  const key = crypto.randomUUID();
  const hashedKey = await bcrypt.hash(key, 5);
  return {
    key,
    hashedKey,
  };
}

export async function generateAPIKey(userParams: UserParams & { admin?: boolean }) {
  const { userId, name, email, admin } = userParams;

  const keyOptions = {
    id: userId,
    name,
    email,
    apiKeyVersion: 1,
    issuer: "Close Powerlifting",
  };

  if (admin) {
    const key = jwt.sign(keyOptions, config.app.jwtSecret);
    return {
      unhashedKey: key,
      hashedKey: await bcrypt.hash(key, parseInt(config.app.passwordSalt)),
    };
  } else {
    const key = jwt.sign(keyOptions, config.app.jwtSecret, { expiresIn: "3m" });
    return {
      unhashedKey: key,
      hashedKey: await bcrypt.hash(key, parseInt(config.app.passwordSalt)),
    };
  }
}

export function generatePassword(length = 50): string {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
}

export function getGoogleOAuthURL() {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";

  const options = {
    redirect_uri: config.oauth.google.redirectUrl,
    client_id: config.oauth.google.clientId,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
}
