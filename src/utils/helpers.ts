import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request } from 'express';
import jwt from 'jsonwebtoken';

import { DOMAIN, ENV, JWT_SECRET, PASSWORD_SALT } from '../config/constants';
import { OAUTH } from '../config/constants';
import { UserParams } from '../views/views.services';

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
    headers[i] = table.rows[0].cells[i].innerHTML.toLowerCase().replace(/ /gi, '');
  }

  // go through cells
  for (let i = 1; i < table.rows.length; i++) {
    const tableRow = table.rows[i];
    const rowData = {};

    for (var j = 0; j < tableRow.cells.length; j++) {
      // @ts-ignore
      rowData[headers[j]] = tableRow.cells[j].innerHTML.replace(/(<([^>]+)>)/gi, '');
    }

    data.push(rowData);
  }

  return data;
}

export function stripHTML(innerHTML: string): string {
  return innerHTML.replace(/(<([^>]+)>)/gi, '');
}

export function getHostName(req: Request): string {
  let origin = '';

  if (ENV === 'development') {
    const protocol = req.protocol;
    const hostname = req.get('host');
    origin = `${protocol}://${hostname}`;
  } else {
    origin = DOMAIN!;
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

/**
 * Generate an API key with a three-month expiration.
 *
 * @param {UserParams} userParams - The parameters required to generate the API key.
 * @returns {Promise<{ unhashedKey: string, hashedKey: string }>} - The generated API key (unhashed and hashed).
 *
 */
export async function generateAPIKey(userParams: UserParams) {
  const { userId, name, email } = userParams;
  const key = jwt.sign(
    {
      id: userId,
      name,
      email,
    },
    JWT_SECRET!,
    {
      issuer: 'Close Powerlifting',
      expiresIn: '3m', // Three-month expiration
    },
  );

  return {
    unhashedKey: key,
    hashedKey: await bcrypt.hash(key, parseInt(PASSWORD_SALT!)),
  };
}

export function getGoogleOAuthURL() {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';

  const options = {
    redirect_uri: OAUTH.GOOGLE.OAUTH_REDIRECT_URL,
    client_id: OAUTH.GOOGLE.CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
}

export function getGitHubOAuthURL() {
  const rootUrl = 'https://github.com/login/oauth/authorize';

  const options = {
    redirect_uri: OAUTH.GITHUB.OAUTH_REDIRECT_URL,
    client_id: OAUTH.GITHUB.CLIENT_ID,
    scope: 'user:email',
  };

  const qs = new URLSearchParams(options);

  return `${rootUrl}?${qs.toString()}`;
}
