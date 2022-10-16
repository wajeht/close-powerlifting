import { JSDOM } from 'jsdom';
import axios from 'axios';

import { tableToJson } from '../../utils/helpers';
import { BASE_URL, API } from '../../config/constants';
import { getMeetsType } from './meets.validations';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    Host: API?.slice(API.indexOf('www'), API.lastIndexOf('/')),
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0',
    Pragma: 'no-cache',
    TE: 'Trailers',
    'Upgrade-Insecure-Requests': 1,
  },
});

/**
 * It makes a request to the website, gets the HTML, parses the HTML, and returns the data in a JSON
 * format
 * @returns An array of objects.
 */
export async function getMeets({ current_page = 1, per_page = 100, cache = true }: getMeetsType) {
  try {
    const html = await (await api.get('/mlist')).data;
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName('table')[0];
    const table = tableToJson(elements);

    const from = current_page * per_page;
    const to = current_page * per_page + per_page;
    const slicedTable = table.slice(from, to);

    return {
      data: slicedTable,
      cache: true,
      pagination: {
        items: table.length,
        pages: Math.floor(table.length / per_page),
        per_page,
        current_page,
        last_page: Math.floor(table.length / per_page),
        first_page: 1,
        from,
        to,
      },
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
