import { Request } from 'express';
import { ENV, DOMAIN } from '../config/constants';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

type buildPaginationType = {
  current_page: number;
  per_page: number;
};

export function buildPagination({ current_page, per_page }: buildPaginationType): string {
  if (current_page === 1) {
    return `start=${0}&end=${per_page}&lang=en&units=lbs`;
  }
  return `start=${current_page * per_page}&end=${
    current_page * per_page + per_page
  }&lang=en&units=lbs`;
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

  if (ENV === 'development' || ENV == 'development') {
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
