import { JSDOM } from 'jsdom';
import axios from 'axios';

import { tableToJson } from '../../utils/helpers';
import { BASE_URL, API } from '../../config/constants';

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
export async function getMeets({ cache = true }) {
  try {
    const html = await (await api.get('/mlist')).data;
    const dom = new JSDOM(html);
    const table = dom.window.document.getElementsByTagName('table')[0];
    return {
      data: tableToJson(table),
      cache: true,
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
