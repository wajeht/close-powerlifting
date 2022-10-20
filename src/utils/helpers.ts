import { Request } from 'express';
import { ENV, DOMAIN } from '../config/constants';

type buildPaginationType = {
  current_page: number;
  per_page: number;
};

/**
 * This function takes an object with two properties, current_page and per_page, and returns a string
 * with the start and end values for pagination.
 * @param {buildPaginationType}  - current_page - The current page of the search results
 * @returns A string
 */
export function buildPagination({ current_page, per_page }: buildPaginationType): string {
  if (current_page === 1) {
    return `start=${0}&end=${per_page}&lang=en&units=lbs`;
  }
  return `start=${current_page * per_page}&end=${
    current_page * per_page + per_page
  }&lang=en&units=lbs`;
}

/**
 * It takes a table and returns an array of objects
 * @param {any} table - The table you want to convert to JSON.
 * @returns An array of objects.
 */
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

/**
 * StripHTML takes a string and returns a string.
 * @param {string} innerHTML - The HTML string to be stripped of HTML tags.
 * @returns The innerHTML of the element is being returned.
 */
export function stripHTML(innerHTML: string): string {
  return innerHTML.replace(/(<([^>]+)>)/gi, '');
}

/**
 * It returns the hostname of the request
 * @param {Request} req - Request - The request object from the Express framework.
 * @returns The hostname of the request.
 */
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
